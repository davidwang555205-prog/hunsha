package credits

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/config"
	"bridal/backend/db"
	"bridal/backend/domain"
)

// Usecase 积分业务层。
type Usecase struct {
	repo   *Repo
	cfg    *config.Config
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		cfg:    do.MustInvoke[*config.Config](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "credits.usecase"),
	}, nil
}

// TransactionResp 对外积分明细，对应前端 CreditTransaction。
type TransactionResp struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	Username      string  `json:"username"`
	DisplayName   string  `json:"displayName"`
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	Type          string  `json:"type"`
	Amount        int     `json:"amount"`
	BalanceAfter  int     `json:"balanceAfter"`
	Description   string  `json:"description"`
	RelatedTaskID *string `json:"relatedTaskId"`
	CreatedAt     string  `json:"createdAt"`
}

func sanitizeTransaction(r CreditTransactionRecord) TransactionResp {
	resp := TransactionResp{
		ID:           r.ID.String(),
		UserID:       r.UserID.String(),
		Type:         r.Type,
		Amount:       r.Amount,
		BalanceAfter: r.BalanceAfter,
		Description:  r.Description,
		CreatedAt:    r.CreatedAt.Format(time.RFC3339),
	}
	if r.RelatedTaskID != nil {
		s := r.RelatedTaskID.String()
		resp.RelatedTaskID = &s
	}
	return resp
}

// ListTransactions 当前用户积分明细。
func (u *Usecase) ListTransactions(ctx context.Context, userID uuid.UUID) ([]TransactionResp, error) {
	recs, err := u.repo.ListTransactions(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]TransactionResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitizeTransaction(r))
	}
	return out, nil
}

// AllTransactionsResp admin 全平台流水响应。
type AllTransactionsResp struct {
	Transactions []TransactionResp `json:"transactions"`
	Total        int               `json:"total"`
	Page         int               `json:"page"`
	PageSize     int               `json:"pageSize"`
}

// ListAllTransactions admin 查全平台积分流水（分页倒序，支持过滤）。
// batch 查 users 拼 username/displayName（credit_transactions 无 user edge，手工关联）。
func (u *Usecase) ListAllTransactions(ctx context.Context, page, pageSize int, filter TransactionFilter) (*AllTransactionsResp, error) {
	recs, total, err := u.repo.ListAllTransactions(ctx, page, pageSize, filter)
	if err != nil {
		return nil, err
	}
	// batch 查全部 users 建 map（用户量不大，单次查询够用）。
	// 账号查询直连 ent users 表，不再依赖 bridalauth.Repo。
	userMap := map[uuid.UUID]*domain.User{}
	if len(recs) > 0 {
		users, lerr := u.repo.db.User.Query().All(ctx)
		if lerr == nil {
			for _, uu := range users {
				userMap[uu.ID] = (&domain.User{}).From(uu)
			}
		}
	}
	out := make([]TransactionResp, 0, len(recs))
	for _, r := range recs {
		resp := sanitizeTransaction(r)
		if uu, ok := userMap[r.UserID]; ok {
			resp.Username = uu.Username
			resp.DisplayName = uu.DisplayName
			resp.Name = uu.Name
			resp.Email = uu.Email
		}
		out = append(out, resp)
	}
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return &AllTransactionsResp{Transactions: out, Total: total, Page: page, PageSize: pageSize}, nil
}

// GetBalance 当前用户余额。
func (u *Usecase) GetBalance(ctx context.Context, userID uuid.UUID) (int, error) {
	return u.repo.GetBalance(ctx, userID)
}

// AdjustResp admin 调整积分响应。
// 注：原 bridalauth.AccountSummary（含历史统计）随 bridalauth 移除，
// 账号概要改由 team MemberList 接口提供，adjust 响应只回 user + balance。
type AdjustResp struct {
	User    *domain.User `json:"user"`
	Balance int          `json:"balance"`
}

// Adjust admin 调整用户积分（amount 正数充值/增加，负数扣减）。
func (u *Usecase) Adjust(ctx context.Context, targetID uuid.UUID, amount int, txType, desc string) (*AdjustResp, error) {
	if amount == 0 {
		return nil, fmt.Errorf("调整金额不能为 0")
	}
	if txType == "" {
		if amount > 0 {
			txType = "recharge"
		} else {
			txType = "adjust"
		}
	}
	if desc == "" {
		desc = "管理员调整"
	}
	balance, err := u.repo.AdjustBalance(ctx, targetID, amount, txType, desc, nil)
	if err != nil {
		return nil, err
	}
	tu, err := u.repo.db.User.Get(ctx, targetID)
	if err != nil {
		if db.IsNotFound(err) {
			return nil, fmt.Errorf("用户不存在")
		}
		return nil, fmt.Errorf("读取用户失败: %w", err)
	}
	return &AdjustResp{
		User:    (&domain.User{}).From(tu),
		Balance: balance,
	}, nil
}

// Consume 生图消耗积分（runTask 调，TODO 接入）。amount 负数。
func (u *Usecase) Consume(ctx context.Context, userID uuid.UUID, amount int, taskID uuid.UUID, desc string) error {
	if amount >= 0 {
		return nil
	}
	_, err := u.repo.AdjustBalance(ctx, userID, amount, "consume", desc, &taskID)
	return err
}
