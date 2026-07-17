package categories

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/category"
	"bridal/backend/db/user"
)

// Repo 内容类目仓储，操作 ent categories 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "categories.repo"),
	}, nil
}

// CategoryRecord 类目记录，对应前端 Category 类型。
type CategoryRecord struct {
	ID          uuid.UUID
	Name        string
	Icon        string
	Engine      string
	Description string
	SortOrder   int
	IsEnabled   bool
	Config      map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func toRecord(c *db.Category) CategoryRecord {
	return CategoryRecord{
		ID:          c.ID,
		Name:        c.Name,
		Icon:        c.Icon,
		Engine:      c.Engine,
		Description: c.Description,
		SortOrder:   c.SortOrder,
		IsEnabled:   c.IsEnabled,
		Config:      c.Config,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

// ListAll 管理列表（含禁用的），按 sort_order。
func (r *Repo) ListAll(ctx context.Context) ([]CategoryRecord, error) {
	cs, err := r.db.Category.Query().
		Order(db.Asc(category.FieldSortOrder), db.Asc(category.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// ListEnabled 公开列表（仅启用的），按 sort_order。
func (r *Repo) ListEnabled(ctx context.Context) ([]CategoryRecord, error) {
	cs, err := r.db.Category.Query().
		Where(category.IsEnabledEQ(true)).
		Order(db.Asc(category.FieldSortOrder), db.Asc(category.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// ListEnabledForUser 返回用户可见的启用类目。visible_category_ids 为空表示未设限，
// 以保证存量用户和新建用户默认仍可看到全部类目。
func (r *Repo) ListEnabledForUser(ctx context.Context, userID uuid.UUID) ([]CategoryRecord, error) {
	usr, err := r.db.User.Query().
		Where(user.IDEQ(userID)).
		Only(ctx)
	if err != nil {
		return nil, err
	}

	query := r.db.Category.Query().
		Where(category.IsEnabledEQ(true)).
		Order(db.Asc(category.FieldSortOrder), db.Asc(category.FieldCreatedAt))
	if len(usr.VisibleCategoryIds) > 0 {
		query = query.Where(category.IDIn(usr.VisibleCategoryIds...))
	}
	cs, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// GetByID 取单条。
func (r *Repo) GetByID(ctx context.Context, id uuid.UUID) (*CategoryRecord, error) {
	c, err := r.db.Category.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// GetByEngine 按 engine 取单条（用于内容引擎定位）。无则 nil。
func (r *Repo) GetByEngine(ctx context.Context, engine string) (*CategoryRecord, error) {
	cs, err := r.db.Category.Query().
		Where(category.EngineEQ(engine), category.IsEnabledEQ(true)).
		Limit(1).
		All(ctx)
	if err != nil {
		return nil, err
	}
	if len(cs) == 0 {
		return nil, nil
	}
	rec := toRecord(cs[0])
	return &rec, nil
}

// CreateInput 创建类目入参。
type CreateInput struct {
	Name        string
	Icon        string
	Engine      string
	Description string
	SortOrder   int
	IsEnabled   bool
	Config      map[string]any
}

func (r *Repo) Create(ctx context.Context, in CreateInput) (*CategoryRecord, error) {
	if in.Config == nil {
		in.Config = map[string]any{}
	}
	if in.Engine == "" {
		in.Engine = "bridal"
	}
	c, err := r.db.Category.Create().
		SetName(in.Name).
		SetIcon(in.Icon).
		SetEngine(in.Engine).
		SetDescription(in.Description).
		SetSortOrder(in.SortOrder).
		SetIsEnabled(in.IsEnabled).
		SetConfig(in.Config).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// UpdateInput 更新类目入参（指针 nil 表示不改）。
type UpdateInput struct {
	Name        *string
	Icon        *string
	Engine      *string
	Description *string
	SortOrder   *int
	IsEnabled   *bool
	Config      *map[string]any
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*CategoryRecord, error) {
	q := r.db.Category.UpdateOneID(id)
	if in.Name != nil {
		q = q.SetName(*in.Name)
	}
	if in.Icon != nil {
		q = q.SetIcon(*in.Icon)
	}
	if in.Engine != nil {
		q = q.SetEngine(*in.Engine)
	}
	if in.Description != nil {
		q = q.SetDescription(*in.Description)
	}
	if in.SortOrder != nil {
		q = q.SetSortOrder(*in.SortOrder)
	}
	if in.IsEnabled != nil {
		q = q.SetIsEnabled(*in.IsEnabled)
	}
	if in.Config != nil {
		q = q.SetConfig(*in.Config)
	}
	c, err := q.Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// Delete 删除类目。
func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.Category.DeleteOneID(id).Exec(ctx)
}

// SeedDefault 启动时若无任何类目，插"婚纱"类目（engine=bridal）。
func (r *Repo) SeedDefault(ctx context.Context) error {
	count, err := r.db.Category.Query().Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err = r.db.Category.Create().
		SetName("婚纱").
		SetIcon("婚纱").
		SetEngine("bridal").
		SetDescription("婚纱礼服行业小红书内容生成，覆盖试纱、客照、门店等场景。").
		SetSortOrder(0).
		SetIsEnabled(true).
		SetConfig(map[string]any{}).
		Save(ctx)
	return err
}
