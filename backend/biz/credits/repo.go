package credits

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/credittransaction"
)

// Repo 积分仓储，操作 ent credit_transactions 表 + users.credits 字段。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "credits.repo"),
	}, nil
}

// CreditTransactionRecord 积分变动记录，对应前端 CreditTransaction。
type CreditTransactionRecord struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Type          string // recharge|consume|adjust
	Amount        int    // 正数增加，负数扣减
	BalanceAfter  int
	Description   string
	RelatedTaskID *uuid.UUID
	CreatedAt     time.Time
}

// ListTransactions 查用户积分明细（倒序最多 100 条）。
func (r *Repo) ListTransactions(ctx context.Context, userID uuid.UUID) ([]CreditTransactionRecord, error) {
	txs, err := r.db.CreditTransaction.Query().
		Where(credittransaction.UserIDEQ(userID)).
		Order(db.Desc(credittransaction.FieldCreatedAt)).
		Limit(100).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CreditTransactionRecord, 0, len(txs))
	for _, t := range txs {
		rec := CreditTransactionRecord{
			ID:           t.ID,
			UserID:       t.UserID,
			Type:         t.Type,
			Amount:       t.Amount,
			BalanceAfter: t.BalanceAfter,
			Description:  t.Description,
			CreatedAt:    t.CreatedAt,
		}
		if t.RelatedTaskID != uuid.Nil {
			id := t.RelatedTaskID
			rec.RelatedTaskID = &id
		}
		out = append(out, rec)
	}
	return out, nil
}

// TransactionFilter 积分流水过滤条件（admin 用）。
type TransactionFilter struct {
	UserID    *uuid.UUID
	Type      string // recharge|consume|adjust
	StartTime *time.Time
	EndTime   *time.Time
}

// ListAllTransactions 全平台积分明细（admin 用，分页倒序，支持过滤）。
func (r *Repo) ListAllTransactions(ctx context.Context, page, pageSize int, filter TransactionFilter) ([]CreditTransactionRecord, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	q := r.db.CreditTransaction.Query()
	if filter.UserID != nil {
		q = q.Where(credittransaction.UserIDEQ(*filter.UserID))
	}
	if filter.Type != "" {
		q = q.Where(credittransaction.TypeEQ(filter.Type))
	}
	if filter.StartTime != nil {
		q = q.Where(credittransaction.CreatedAtGTE(*filter.StartTime))
	}
	if filter.EndTime != nil {
		q = q.Where(credittransaction.CreatedAtLTE(*filter.EndTime))
	}
	total, err := q.Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	txs, err := q.
		Order(db.Desc(credittransaction.FieldCreatedAt)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}
	out := make([]CreditTransactionRecord, 0, len(txs))
	for _, t := range txs {
		rec := CreditTransactionRecord{
			ID:            t.ID,
			UserID:        t.UserID,
			Type:          t.Type,
			Amount:        t.Amount,
			BalanceAfter:  t.BalanceAfter,
			Description:   t.Description,
			CreatedAt:     t.CreatedAt,
		}
		if t.RelatedTaskID != uuid.Nil {
			id := t.RelatedTaskID
			rec.RelatedTaskID = &id
		}
		out = append(out, rec)
	}
	return out, total, nil
}

// GetBalance 读用户积分余额（ent users.credits）。
func (r *Repo) GetBalance(ctx context.Context, userID uuid.UUID) (int, error) {
	u, err := r.db.User.Get(ctx, userID)
	if err != nil {
		return 0, err
	}
	return u.Credits, nil
}

// AdjustBalance 事务：更新 user.Credits += delta（不低于 0）+ 写 transaction。返回新余额。
func (r *Repo) AdjustBalance(ctx context.Context, userID uuid.UUID, delta int, txType, desc string, taskID *uuid.UUID) (int, error) {
	tx, err := r.db.Tx(ctx)
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	u, err := tx.User.Get(ctx, userID)
	if err != nil {
		return 0, err
	}
	newBalance := u.Credits + delta
	if newBalance < 0 {
		newBalance = 0
	}
	if _, err = tx.User.UpdateOneID(userID).SetCredits(newBalance).Save(ctx); err != nil {
		return 0, err
	}
	ct := tx.CreditTransaction.Create().
		SetUserID(userID).
		SetType(txType).
		SetAmount(delta).
		SetBalanceAfter(newBalance).
		SetDescription(desc)
	if taskID != nil {
		ct = ct.SetRelatedTaskID(*taskID)
	}
	if _, err = ct.Save(ctx); err != nil {
		return 0, err
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	return newBalance, nil
}
