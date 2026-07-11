package bridalauth

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/db/user"
)

// Repo 是 bridal 认证层用户仓储，直接操作 ent users 表。
// 独立于 MonkeyCode biz/user/repo（后者耦合 OIDC 检查 + bcrypt + team 查询）。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i),
	}, nil
}

// FindByUsername 按 username 精确查询（大小写敏感，与 Node findUserByName 一致）。
func (r *Repo) FindByUsername(ctx context.Context, username string) (*User, error) {
	u, err := r.db.User.Query().
		Where(user.Username(username)).
		Only(ctx)
	if err != nil {
		if db.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return entToUser(u), nil
}

// GetByID 按 id 查询。
func (r *Repo) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	u, err := r.db.User.Get(ctx, id)
	if err != nil {
		if db.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return entToUser(u), nil
}

// CreateUserParams 创建账号参数。
type CreateUserParams struct {
	ID              uuid.UUID
	Username        string
	DisplayName     string
	Role            string
	Password        string
	DailyImageLimit int
}

// Create 创建 bridal 用户（scrypt hash 密码）。
func (r *Repo) Create(ctx context.Context, p CreateUserParams) (*User, error) {
	hash, salt, err := HashPassword(p.Password, "")
	if err != nil {
		return nil, err
	}
	builder := r.db.User.Create().
		SetID(p.ID).
		SetUsername(p.Username).
		SetDisplayName(p.DisplayName).
		SetRole(consts.UserRole(p.Role)).
		SetStatus(consts.UserStatusActive).
		SetDailyImageLimit(p.DailyImageLimit).
		SetPasswordSalt(salt).
		SetPasswordHash(hash).
		SetName(p.Username) // MonkeyCode name 字段非空，bridal 用 username 填充

	u, err := builder.Save(ctx)
	if err != nil {
		return nil, err
	}
	return entToUser(u), nil
}

// CountUsers 返回用户总数（用于账号初始化判断）。
func (r *Repo) CountUsers(ctx context.Context) (int, error) {
	return r.db.User.Query().Count(ctx)
}

// ListAllUsers 返回全部 bridal 用户（admin 账号概要用），按创建时间升序。
func (r *Repo) ListAllUsers(ctx context.Context) ([]*User, error) {
	us, err := r.db.User.Query().
		Order(db.Asc(user.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*User, 0, len(us))
	for _, u := range us {
		out = append(out, entToUser(u))
	}
	return out, nil
}

// SetPassword 重置密码（scrypt）。
func (r *Repo) SetPassword(ctx context.Context, id uuid.UUID, password string) error {
	hash, salt, err := HashPassword(password, "")
	if err != nil {
		return err
	}
	return r.db.User.UpdateOneID(id).
		SetPasswordSalt(salt).
		SetPasswordHash(hash).
		Exec(ctx)
}

// SetDailyImageLimit 更新每日额度。
func (r *Repo) SetDailyImageLimit(ctx context.Context, id uuid.UUID, limit int) error {
	return r.db.User.UpdateOneID(id).
		SetDailyImageLimit(limit).
		Exec(ctx)
}

// entToUser ent.User -> bridal User。
func entToUser(u *db.User) *User {
	if u == nil {
		return nil
	}
	return &User{
		ID:              u.ID,
		Username:        u.Username,
		DisplayName:     u.DisplayName,
		Role:            string(u.Role),
		DailyImageLimit: u.DailyImageLimit,
		PasswordSalt:    u.PasswordSalt,
		PasswordHash:    u.PasswordHash,
		CreatedAt:       u.CreatedAt,
	}
}
