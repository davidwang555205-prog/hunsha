package bridalauth

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/config"
)

// ProvideBridalAuth 注册 bridal 认证层依赖（Repo + Usecase）。
func ProvideBridalAuth(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
}

// InvokeBridalAuth 实例化 Handler（注册路由）并执行账号初始化。
func InvokeBridalAuth(i *do.Injector) {
	// 账号初始化：与 Node ensureInitialUsers 一致，空库时建 admin/wang。
	repo := do.MustInvoke[*Repo](i)
	cfg := do.MustInvoke[*config.Config](i)
	logger := do.MustInvoke[*slog.Logger](i).With("module", "bridalauth.init")
	if err := EnsureInitialUsers(context.Background(), repo, cfg, logger); err != nil {
		logger.Error("ensure initial users failed", "error", err)
	}

	// 实例化 Handler 注册路由（NewHandler 内部挂载 /api/login、/api/me、/api/admin/users）。
	do.MustInvoke[*Handler](i)
}

// EnsureInitialUsers 与 Node ensureInitialUsers 一致：
// 仅在 users 表为空时初始化 admin/wang 两个账号（幂等）。
func EnsureInitialUsers(ctx context.Context, repo *Repo, cfg *config.Config, logger *slog.Logger) error {
	count, err := repo.CountUsers(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		logger.Info("users already initialized, skip", "count", count)
		return nil
	}

	adminPwd := cfg.Bridal.AdminPassword
	if adminPwd == "" {
		adminPwd = "admin123"
	}
	userPwd := cfg.Bridal.UserPassword
	if userPwd == "" {
		userPwd = "user123"
	}
	defaultLimit := cfg.Bridal.DefaultDailyImageLimit
	if defaultLimit <= 0 {
		defaultLimit = DefaultDailyImageLimit
	}

	// admin 账号：role=admin，dailyImageLimit 存默认值但 admin 不受限（HasUnlimitedImageGeneration 看 role）。
	if _, err := repo.Create(ctx, CreateUserParams{
		ID:              uuid.New(),
		Username:        "admin",
		DisplayName:     "管理员",
		Role:            RoleAdmin,
		Password:        adminPwd,
		DailyImageLimit: defaultLimit,
	}); err != nil {
		return err
	}
	if _, err := repo.Create(ctx, CreateUserParams{
		ID:              uuid.New(),
		Username:        "wang",
		DisplayName:     "wang",
		Role:            RoleUser,
		Password:        userPwd,
		DailyImageLimit: defaultLimit,
	}); err != nil {
		return err
	}
	logger.Info("initial users created", "users", []string{"admin", "wang"})
	return nil
}
