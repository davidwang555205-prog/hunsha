package engines

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/contentengine"
)

// Repo 内容引擎仓储，操作 ent content_engines 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "engines.repo"),
	}, nil
}

// EngineRecord 内容引擎记录，对应前端 ContentEngine 类型。
type EngineRecord struct {
	ID          uuid.UUID
	Key         string
	Name        string
	Description string
	Config      map[string]any
	IsEnabled   bool
	SortOrder   int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func toRecord(e *db.ContentEngine) EngineRecord {
	return EngineRecord{
		ID:          e.ID,
		Key:         e.Key,
		Name:        e.Name,
		Description: e.Description,
		Config:      e.Config,
		IsEnabled:   e.IsEnabled,
		SortOrder:   e.SortOrder,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

func (r *Repo) ListAll(ctx context.Context) ([]EngineRecord, error) {
	es, err := r.db.ContentEngine.Query().
		Order(db.Asc(contentengine.FieldSortOrder), db.Asc(contentengine.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EngineRecord, 0, len(es))
	for _, e := range es {
		out = append(out, toRecord(e))
	}
	return out, nil
}

// EngineSummaryRecord 列表用的精简引擎记录（无 Config，对应前端 ContentEngineSummary）。
// config 是 jsonb 大字段（单值几十到几百 KB），管理列表页只展示 8 个标量字段，
// SELECT * 全量返回会让 PG 解码 + Go 反序列化 + JSON 响应体全部放大到 MB 级。
type EngineSummaryRecord struct {
	ID          uuid.UUID
	Key         string
	Name        string
	Description string
	IsEnabled   bool
	SortOrder   int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// ListSummary 管理列表专用：Select 投影裁掉 config 大字段，响应体从 MB 级降到 KB 级。
func (r *Repo) ListSummary(ctx context.Context) ([]EngineSummaryRecord, error) {
	es, err := r.db.ContentEngine.Query().
		Select(
			contentengine.FieldID,
			contentengine.FieldKey,
			contentengine.FieldName,
			contentengine.FieldDescription,
			contentengine.FieldIsEnabled,
			contentengine.FieldSortOrder,
			contentengine.FieldCreatedAt,
			contentengine.FieldUpdatedAt,
		).
		Order(db.Asc(contentengine.FieldSortOrder), db.Asc(contentengine.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EngineSummaryRecord, 0, len(es))
	for _, e := range es {
		out = append(out, EngineSummaryRecord{
			ID:          e.ID,
			Key:         e.Key,
			Name:        e.Name,
			Description: e.Description,
			IsEnabled:   e.IsEnabled,
			SortOrder:   e.SortOrder,
			CreatedAt:   e.CreatedAt,
			UpdatedAt:   e.UpdatedAt,
		})
	}
	return out, nil
}

// GetByID 按 ID 取完整引擎记录（含 config），编辑弹窗回填用。
func (r *Repo) GetByID(ctx context.Context, id uuid.UUID) (*EngineRecord, error) {
	e, err := r.db.ContentEngine.Get(ctx, id)
	if err != nil {
		if db.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	rec := toRecord(e)
	return &rec, nil
}

func (r *Repo) ListEnabled(ctx context.Context) ([]EngineRecord, error) {
	es, err := r.db.ContentEngine.Query().
		Where(contentengine.IsEnabledEQ(true)).
		Order(db.Asc(contentengine.FieldSortOrder), db.Asc(contentengine.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EngineRecord, 0, len(es))
	for _, e := range es {
		out = append(out, toRecord(e))
	}
	return out, nil
}

func (r *Repo) GetByKey(ctx context.Context, key string) (*EngineRecord, error) {
	es, err := r.db.ContentEngine.Query().
		Where(contentengine.KeyEQ(key)).
		Limit(1).
		All(ctx)
	if err != nil {
		return nil, err
	}
	if len(es) == 0 {
		return nil, nil
	}
	rec := toRecord(es[0])
	return &rec, nil
}

// CreateInput 创建引擎入参。
type CreateInput struct {
	Key         string
	Name        string
	Description string
	Config      map[string]any
	IsEnabled   bool
	SortOrder   int
}

func (r *Repo) Create(ctx context.Context, in CreateInput) (*EngineRecord, error) {
	if in.Config == nil {
		in.Config = map[string]any{}
	}
	e, err := r.db.ContentEngine.Create().
		SetKey(in.Key).
		SetName(in.Name).
		SetDescription(in.Description).
		SetConfig(in.Config).
		SetIsEnabled(in.IsEnabled).
		SetSortOrder(in.SortOrder).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(e)
	return &rec, nil
}

// UpdateInput 更新引擎入参（指针 nil 表示不改）。
type UpdateInput struct {
	Key         *string
	Name        *string
	Description *string
	Config      *map[string]any
	IsEnabled   *bool
	SortOrder   *int
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*EngineRecord, error) {
	q := r.db.ContentEngine.UpdateOneID(id)
	if in.Key != nil {
		q = q.SetKey(*in.Key)
	}
	if in.Name != nil {
		q = q.SetName(*in.Name)
	}
	if in.Description != nil {
		q = q.SetDescription(*in.Description)
	}
	if in.Config != nil {
		q = q.SetConfig(*in.Config)
	}
	if in.IsEnabled != nil {
		q = q.SetIsEnabled(*in.IsEnabled)
	}
	if in.SortOrder != nil {
		q = q.SetSortOrder(*in.SortOrder)
	}
	e, err := q.Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(e)
	return &rec, nil
}

func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.ContentEngine.DeleteOneID(id).Exec(ctx)
}

// SeedDefault 启动时若无任何引擎，插"婚纱礼服内容引擎"（key=bridal）。
func (r *Repo) SeedDefault(ctx context.Context) error {
	count, err := r.db.ContentEngine.Query().Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err = r.db.ContentEngine.Create().
		SetKey("bridal").
		SetName("婚纱礼服内容引擎").
		SetDescription("婚纱礼服行业小红书内容生成，覆盖试纱、客照、门店等场景。").
		SetConfig(map[string]any{}).
		SetIsEnabled(true).
		SetSortOrder(0).
		Save(ctx)
	return err
}
