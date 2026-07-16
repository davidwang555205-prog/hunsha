package generation

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"bridal/backend/db"
	"bridal/backend/db/generationimage"
	"bridal/backend/db/generationtask"
)

// statsAdapter 历史统计适配器，桥接 generation.Repo。
// 原实现 bridalauth.HistoryStats 供 bridalauth.Usecase 调用；bridalauth 移除后保留统计方法供未来复用。
type statsAdapter struct {
	repo *Repo
}

// NewStatsAdapter 创建统计适配器。
func NewStatsAdapter(repo *Repo) *statsAdapter {
	return &statsAdapter{repo: repo}
}

// UserStats 返回 (requestCount, successCount, generatedImageCount)。
func (s *statsAdapter) UserStats(ctx context.Context, userID uuid.UUID, isAdmin bool) (int, int, int, error) {
	q := s.repo.db.GenerationTask.Query().Where(generationtask.DeletedEQ(false))
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	tasks, err := q.All(ctx)
	if err != nil {
		return 0, 0, 0, err
	}
	request := len(tasks)
	success := 0
	taskIDs := make([]uuid.UUID, 0, len(tasks))
	for _, t := range tasks {
		if t.Status == "completed" {
			success++
		}
		taskIDs = append(taskIDs, t.ID)
	}
	imageCount := 0
	if len(taskIDs) > 0 {
		imageCount, err = s.repo.db.GenerationImage.Query().
			Where(generationimage.TaskIDIn(taskIDs...), generationimage.DeletedEQ(false)).
			Count(ctx)
		if err != nil {
			imageCount = 0
		}
	}
	return request, success, imageCount, nil
}

// DailyImages 返回用户当日（上海时区）已生成图片数。
func (s *statsAdapter) DailyImages(ctx context.Context, userID uuid.UUID, isAdmin bool) (int, error) {
	dateKey := shanghaiDateKey(time.Now())
	loc := time.FixedZone("CST", 8*3600)
	dayStart, err := time.ParseInLocation("2006-01-02", dateKey, loc)
	if err != nil {
		return 0, err
	}
	dayEnd := dayStart.Add(24 * time.Hour)

	q := s.repo.db.GenerationTask.Query().Where(
		generationtask.DeletedEQ(false),
		generationtask.CreatedAtGTE(dayStart),
		generationtask.CreatedAtLT(dayEnd),
	)
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	taskIDs, err := q.IDs(ctx)
	if err != nil || len(taskIDs) == 0 {
		return 0, err
	}
	return s.repo.db.GenerationImage.Query().
		Where(generationimage.TaskIDIn(taskIDs...), generationimage.DeletedEQ(false)).
		Count(ctx)
}

// LastGeneratedAt 返回最近一次生图时间，无记录返回 nil。
func (s *statsAdapter) LastGeneratedAt(ctx context.Context, userID uuid.UUID, isAdmin bool) (*time.Time, error) {
	q := s.repo.db.GenerationTask.Query().Where(generationtask.DeletedEQ(false))
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	t, err := q.Order(db.Desc(generationtask.FieldCreatedAt)).First(ctx)
	if err != nil {
		return nil, nil // 无记录不报错
	}
	createdAt := t.CreatedAt
	return &createdAt, nil
}

// StatsResp 生图统计（admin 概览页用）。
type StatsResp struct {
	RequestCount    int   `json:"requestCount"`    // 生成任务总数
	SuccessCount    int   `json:"successCount"`    // 成功数
	FailedCount     int   `json:"failedCount"`     // 失败数
	ImageCount      int   `json:"imageCount"`      // 生成图片总数
	DailyImages     int   `json:"dailyImages"`     // 今日生成图片数
	LastGeneratedAt int64 `json:"lastGeneratedAt"` // 最近生图时间（unix 秒，0=无记录）
}

// TrendDay 单日趋势聚合（上海时区日期）。
type TrendDay struct {
	Date    string `json:"date"`    // YYYY-MM-DD（上海时区）
	Total   int    `json:"total"`   // 当天任务数
	Success int    `json:"success"` // 当天 completed 数
	Failed  int    `json:"failed"`  // 当天 failed 数
	Images  int    `json:"images"`  // 当天完成图片数（=任务 completed_count 之和，近似）
}

// ChannelTrend 单条模型线路的趋势。
type ChannelTrend struct {
	ChannelID   string     `json:"channelId"`
	ChannelName string     `json:"channelName"`
	Days        []TrendDay `json:"days"`
}

// StatsTrendResp 趋势统计（admin 概览页趋势图用）。
type StatsTrendResp struct {
	Days     []TrendDay     `json:"days"`     // 总趋势（最近 N 天）
	Channels []ChannelTrend `json:"channels"` // 分模型链路趋势
}

// Stats 生图统计。isAdmin=true 返回全平台，否则仅当前用户。复用 statsAdapter 三个查询。
func (u *Usecase) Stats(ctx context.Context, userID uuid.UUID, isAdmin bool) (*StatsResp, error) {
	request, success, image, err := u.stats.UserStats(ctx, userID, isAdmin)
	if err != nil {
		return nil, err
	}
	resp := &StatsResp{
		RequestCount: request,
		SuccessCount: success,
		FailedCount:  request - success,
		ImageCount:   image,
	}
	if daily, derr := u.stats.DailyImages(ctx, userID, isAdmin); derr == nil {
		resp.DailyImages = daily
	}
	if t, terr := u.stats.LastGeneratedAt(ctx, userID, isAdmin); terr == nil && t != nil {
		resp.LastGeneratedAt = t.Unix()
	}
	return resp, nil
}

// Trend 按天聚合趋势（上海时区）。返回总趋势 + 分模型（channelID -> 每日）。
// 复用 generationtask 查询；images 用 task.completed_count 求和近似（避免逐天查 image 表）。
// channel_id 为空的 task 只进总趋势，不进分模型。
func (s *statsAdapter) Trend(ctx context.Context, userID uuid.UUID, isAdmin bool, days int) ([]TrendDay, map[uuid.UUID][]TrendDay, error) {
	if days <= 0 {
		days = 14
	}
	if days > 90 {
		days = 90
	}
	loc := time.FixedZone("CST", 8*3600)
	dayStart, err := time.ParseInLocation("2006-01-02", shanghaiDateKey(time.Now()), loc)
	if err != nil {
		return nil, nil, err
	}
	start := dayStart.AddDate(0, 0, -(days - 1))
	end := dayStart.Add(24 * time.Hour)

	q := s.repo.db.GenerationTask.Query().Where(
		generationtask.DeletedEQ(false),
		generationtask.CreatedAtGTE(start),
		generationtask.CreatedAtLT(end),
	)
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	tasks, err := q.All(ctx)
	if err != nil {
		return nil, nil, err
	}

	// 预填 N 天日期序列，保证 x 轴连续（无数据日为 0）。
	dateKeys := make([]string, 0, days)
	totalMap := make(map[string]*TrendDay, days)
	for i := 0; i < days; i++ {
		dk := shanghaiDateKey(start.AddDate(0, 0, i))
		dateKeys = append(dateKeys, dk)
		totalMap[dk] = &TrendDay{Date: dk}
	}
	chanMap := make(map[uuid.UUID]map[string]*TrendDay)

	for _, t := range tasks {
		dk := shanghaiDateKey(t.CreatedAt)
		d := totalMap[dk]
		if d == nil {
			continue
		}
		d.Total++
		if t.Status == "completed" {
			d.Success++
		} else {
			d.Failed++
		}
		d.Images += t.CompletedCount

		if t.ChannelID != uuid.Nil {
			cm := chanMap[t.ChannelID]
			if cm == nil {
				cm = make(map[string]*TrendDay)
				chanMap[t.ChannelID] = cm
			}
			cd := cm[dk]
			if cd == nil {
				cd = &TrendDay{Date: dk}
				cm[dk] = cd
			}
			cd.Total++
			if t.Status == "completed" {
				cd.Success++
			} else {
				cd.Failed++
			}
			cd.Images += t.CompletedCount
		}
	}

	totalDays := make([]TrendDay, 0, days)
	for _, dk := range dateKeys {
		totalDays = append(totalDays, *totalMap[dk])
	}
	chanDays := make(map[uuid.UUID][]TrendDay, len(chanMap))
	for chID, cm := range chanMap {
		seq := make([]TrendDay, 0, days)
		for _, dk := range dateKeys {
			if cd := cm[dk]; cd != nil {
				seq = append(seq, *cd)
			} else {
				seq = append(seq, TrendDay{Date: dk})
			}
		}
		chanDays[chID] = seq
	}
	return totalDays, chanDays, nil
}

// StatsTrend 趋势统计。isAdmin=true 返回全平台，否则仅当前用户。补 channel 名称。
func (u *Usecase) StatsTrend(ctx context.Context, userID uuid.UUID, isAdmin bool, days int) (*StatsTrendResp, error) {
	totalDays, chanDays, err := u.stats.Trend(ctx, userID, isAdmin, days)
	if err != nil {
		return nil, err
	}
	nameOf := make(map[uuid.UUID]string)
	if chans, cerr := u.channels.ListAdmin(ctx); cerr == nil {
		for _, c := range chans {
			if id, perr := uuid.Parse(c.ID); perr == nil {
				nameOf[id] = c.Name
			}
		}
	}
	channels := make([]ChannelTrend, 0, len(chanDays))
	for chID, days2 := range chanDays {
		name := nameOf[chID]
		if name == "" {
			name = "未知线路"
		}
		channels = append(channels, ChannelTrend{
			ChannelID:   chID.String(),
			ChannelName: name,
			Days:        days2,
		})
	}
	sort.Slice(channels, func(i, j int) bool {
		return channels[i].ChannelName < channels[j].ChannelName
	})
	return &StatsTrendResp{Days: totalDays, Channels: channels}, nil
}
