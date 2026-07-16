package syssetting

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/systemsetting"
)

// Repo 系统设置仓储，操作 ent system_settings 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "syssetting.repo"),
	}, nil
}

// SettingRecord 设置记录。
type SettingRecord struct {
	ID        uuid.UUID
	Key       string
	Value     map[string]any
	UpdatedAt time.Time
}

func toRecord(s *db.SystemSetting) SettingRecord {
	return SettingRecord{
		ID:        s.ID,
		Key:       s.Key,
		Value:     s.Value,
		UpdatedAt: s.UpdatedAt,
	}
}

// Get 按 key 取设置，无则 nil。
func (r *Repo) Get(ctx context.Context, key string) (*SettingRecord, error) {
	ss, err := r.db.SystemSetting.Query().
		Where(systemsetting.KeyEQ(key)).
		Limit(1).
		All(ctx)
	if err != nil {
		return nil, err
	}
	if len(ss) == 0 {
		return nil, nil
	}
	rec := toRecord(ss[0])
	return &rec, nil
}

// ListAll 全部设置，按 key 排序。
func (r *Repo) ListAll(ctx context.Context) ([]SettingRecord, error) {
	ss, err := r.db.SystemSetting.Query().
		Order(db.Asc(systemsetting.FieldKey)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]SettingRecord, 0, len(ss))
	for _, s := range ss {
		out = append(out, toRecord(s))
	}
	return out, nil
}

// Upsert 设置值（存在更新，不存在创建）。
func (r *Repo) Upsert(ctx context.Context, key string, value map[string]any) (*SettingRecord, error) {
	if value == nil {
		value = map[string]any{}
	}
	existing, err := r.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		s, err := r.db.SystemSetting.UpdateOneID(existing.ID).SetValue(value).Save(ctx)
		if err != nil {
			return nil, err
		}
		rec := toRecord(s)
		return &rec, nil
	}
	s, err := r.db.SystemSetting.Create().SetKey(key).SetValue(value).Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(s)
	return &rec, nil
}
