package bridalauth

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/config"
)

// HistoryStats 历史统计接口（由 generation 包实现并注入），避免 bridalauth 反向依赖 generation。
// 容器中无实现时（Invoke 失败）返回 nil，Me 接口降级返回 0 统计。
type HistoryStats interface {
	// UserStats 返回 (requestCount, successCount, generatedImageCount)。
	UserStats(ctx context.Context, userID uuid.UUID, isAdmin bool) (request, success, images int, err error)
	// DailyImages 返回用户当日（上海时区）已生成图片数。
	DailyImages(ctx context.Context, userID uuid.UUID, isAdmin bool) (int, error)
	// LastGeneratedAt 返回用户最近一次生图时间（admin 看全局），无记录返回 nil。
	LastGeneratedAt(ctx context.Context, userID uuid.UUID, isAdmin bool) (*time.Time, error)
}

// Usecase bridal 认证业务层。
type Usecase struct {
	repo        *Repo
	cfg         *config.Config
	logger      *slog.Logger
	historyStats HistoryStats // 可选，nil 时 Me 的统计降级为 0
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	uc := &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		cfg:    do.MustInvoke[*config.Config](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "bridalauth.usecase"),
	}
	// 可选注入历史统计（generation 包提供），失败则降级。
	if stats, err := do.Invoke[HistoryStats](i); err == nil && stats != nil {
		uc.historyStats = stats
	}
	return uc, nil
}

// secret 返回 HMAC 签名密钥，与 Node 三级回退一致：
// APP_SESSION_SECRET -> admin 密码 -> 固定常量（生产必须配 APP_SESSION_SECRET）。
func (u *Usecase) secret() string {
	if s := u.cfg.Bridal.SessionSecret; s != "" {
		return s
	}
	return "bridal-content-studio-session-secret"
}

// LoginReq 登录请求，与 Node /api/login 请求体一致。
type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResp 登录响应，与 Node 一致：非 admin 无 accounts 字段。
type LoginResp struct {
	Token    string             `json:"token"`
	User     PublicUser         `json:"user"`
	Accounts []AccountSummary   `json:"accounts,omitempty"`
}

// Login 校验账号密码并签发 token。
func (u *Usecase) Login(ctx context.Context, req LoginReq) (*LoginResp, error) {
	user, err := u.repo.FindByUsername(ctx, req.Username)
	if err != nil {
		u.logger.ErrorContext(ctx, "find user failed", "username", req.Username, "error", err)
		return nil, ErrInvalidCredentials
	}
	if user == nil || !VerifyPassword(req.Password, user.PasswordSalt, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}
	token := CreateToken(user.ID, u.secret(), time.Now())

	resp := &LoginResp{
		Token: token,
		User:  user.ToPublic(),
	}
	if user.Role == RoleAdmin {
		accounts, err := u.buildAccountSummaries(ctx)
		if err != nil {
			u.logger.WarnContext(ctx, "build account summaries failed", "error", err)
		} else {
			resp.Accounts = accounts
		}
	}
	return resp, nil
}

// MeResp /api/me 响应，与 Node 一致。
type MeResp struct {
	User     PublicUser       `json:"user"`
	Accounts []AccountSummary `json:"accounts,omitempty"`
	Summary  Summary          `json:"summary"`
}

// Summary 与 Node /api/me summary 字段一致。
// 历史统计（requestCount/successCount/generatedImageCount）由 M3 history 表提供，
// M2 阶段返回 0，retentionDays 立即可用。
type Summary struct {
	RequestCount         int `json:"requestCount"`
	SuccessCount         int `json:"successCount"`
	GeneratedImageCount  int `json:"generatedImageCount"`
	RetentionDays        int `json:"retentionDays"`
}

// Me 返回当前用户信息 + 账号列表 + 概要。
func (u *Usecase) Me(ctx context.Context, userID uuid.UUID) (*MeResp, error) {
	user, err := u.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrLoginExpired
	}

	resp := &MeResp{
		User: user.ToPublic(),
		Summary: Summary{
			RetentionDays: u.cfg.Bridal.HistoryRetentionDays,
		},
	}
	// 历史统计（generation 包注入的 HistoryStats，nil 时降级为 0）。
	if u.historyStats != nil {
		req, succ, imgs, serr := u.historyStats.UserStats(ctx, user.ID, user.Role == RoleAdmin)
		if serr != nil {
			u.logger.WarnContext(ctx, "get user stats failed", "error", serr)
		} else {
			resp.Summary.RequestCount = req
			resp.Summary.SuccessCount = succ
			resp.Summary.GeneratedImageCount = imgs
		}
	}
	if user.Role == RoleAdmin {
		accounts, err := u.buildAccountSummaries(ctx)
		if err != nil {
			u.logger.WarnContext(ctx, "build account summaries failed", "error", err)
		} else {
			resp.Accounts = accounts
		}
	}
	return resp, nil
}

// AccountSummary 与 Node buildAccountSummaries 输出一致。
// 历史相关字段 M3 接入 history 后填充，M2 返回 0。
type AccountSummary struct {
	User                      PublicUser `json:"user"`
	RequestCount              int        `json:"requestCount"`
	SuccessCount              int        `json:"successCount"`
	FailedCount               int        `json:"failedCount"`
	GeneratedImageCount       int        `json:"generatedImageCount"`
	DailyGeneratedImageCount  int        `json:"dailyGeneratedImageCount"`
	LastGeneratedAt           *time.Time `json:"lastGeneratedAt,omitempty"`
}

// buildAccountSummaries admin 查全部账号概要。历史统计由 generation 包提供（nil 时为 0）。
func (u *Usecase) buildAccountSummaries(ctx context.Context) ([]AccountSummary, error) {
	users, err := u.repo.ListAllUsers(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AccountSummary, 0, len(users))
	for _, usr := range users {
		summary := AccountSummary{User: usr.ToPublic()}
		if u.historyStats != nil {
			req, succ, imgs, serr := u.historyStats.UserStats(ctx, usr.ID, false)
			if serr == nil {
				summary.RequestCount = req
				summary.SuccessCount = succ
				summary.FailedCount = req - succ
				summary.GeneratedImageCount = imgs
				// 当日图片数
				if daily, derr := u.historyStats.DailyImages(ctx, usr.ID, false); derr == nil {
					summary.DailyGeneratedImageCount = daily
				}
			}
		}
		if u.historyStats != nil {
			if last, lerr := u.historyStats.LastGeneratedAt(ctx, usr.ID, false); lerr == nil {
				summary.LastGeneratedAt = last
			}
		}
		out = append(out, summary)
	}
	return out, nil
}

// AuthenticateToken 校验 token 返回 user，供中间件使用。
func (u *Usecase) AuthenticateToken(ctx context.Context, token string) (*User, error) {
	uid, err := ParseToken(token, u.secret(), time.Now())
	if err != nil {
		return nil, ErrLoginExpired
	}
	user, err := u.repo.GetByID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrLoginExpired
	}
	return user, nil
}
