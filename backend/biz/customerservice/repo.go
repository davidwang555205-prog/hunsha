package customerservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/customerserviceinfo"
)

// Repo 客服信息仓储，操作 ent customer_service_infos 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "customerservice.repo"),
	}, nil
}

// CustomerServiceRecord 客服记录，对应前端 CustomerService 类型。
type CustomerServiceRecord struct {
	ID        uuid.UUID
	Nickname  string
	Phone     string
	WechatID  string
	QrcodeURL string
	SortOrder int
	IsEnabled bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

func toRecord(c *db.CustomerServiceInfo) CustomerServiceRecord {
	return CustomerServiceRecord{
		ID:        c.ID,
		Nickname:  c.Nickname,
		Phone:     c.Phone,
		WechatID:  c.WechatID,
		QrcodeURL: c.QrcodeURL,
		SortOrder: c.SortOrder,
		IsEnabled: c.IsEnabled,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}

// ListAll 管理列表（含禁用的），按 sort_order。
func (r *Repo) ListAll(ctx context.Context) ([]CustomerServiceRecord, error) {
	cs, err := r.db.CustomerServiceInfo.Query().
		Order(db.Asc(customerserviceinfo.FieldSortOrder), db.Asc(customerserviceinfo.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CustomerServiceRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// ListEnabled 公开列表（仅启用的），按 sort_order。顶栏客服入口用。
func (r *Repo) ListEnabled(ctx context.Context) ([]CustomerServiceRecord, error) {
	cs, err := r.db.CustomerServiceInfo.Query().
		Where(customerserviceinfo.IsEnabledEQ(true)).
		Order(db.Asc(customerserviceinfo.FieldSortOrder), db.Asc(customerserviceinfo.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CustomerServiceRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// GetByID 取单条。
func (r *Repo) GetByID(ctx context.Context, id uuid.UUID) (*CustomerServiceRecord, error) {
	c, err := r.db.CustomerServiceInfo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// CreateInput 创建客服入参。
type CreateInput struct {
	Nickname  string
	Phone     string
	WechatID  string
	QrcodeURL string
	SortOrder int
	IsEnabled bool
}

func (r *Repo) Create(ctx context.Context, in CreateInput) (*CustomerServiceRecord, error) {
	c, err := r.db.CustomerServiceInfo.Create().
		SetNickname(in.Nickname).
		SetPhone(in.Phone).
		SetWechatID(in.WechatID).
		SetQrcodeURL(in.QrcodeURL).
		SetSortOrder(in.SortOrder).
		SetIsEnabled(in.IsEnabled).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// UpdateInput 更新客服入参（指针 nil 表示不改）。
type UpdateInput struct {
	Nickname  *string
	Phone     *string
	WechatID  *string
	QrcodeURL *string
	SortOrder *int
	IsEnabled *bool
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*CustomerServiceRecord, error) {
	q := r.db.CustomerServiceInfo.UpdateOneID(id)
	if in.Nickname != nil {
		q = q.SetNickname(*in.Nickname)
	}
	if in.Phone != nil {
		q = q.SetPhone(*in.Phone)
	}
	if in.WechatID != nil {
		q = q.SetWechatID(*in.WechatID)
	}
	if in.QrcodeURL != nil {
		q = q.SetQrcodeURL(*in.QrcodeURL)
	}
	if in.SortOrder != nil {
		q = q.SetSortOrder(*in.SortOrder)
	}
	if in.IsEnabled != nil {
		q = q.SetIsEnabled(*in.IsEnabled)
	}
	c, err := q.Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// Delete 删除客服。
func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.CustomerServiceInfo.DeleteOneID(id).Exec(ctx)
}
