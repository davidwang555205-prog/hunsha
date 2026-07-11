package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/GoYoko/web"
	"github.com/samber/do"

	"bridal/backend/biz"
	"bridal/backend/config"
	"bridal/backend/pkg"
	"bridal/backend/pkg/dotenv"
	"bridal/backend/pkg/service"
	"bridal/backend/pkg/store"
)

func main() {
	// 加载 bridal 项目根 .env（与 Node server/index.mjs applyDotEnv 一致），
	// 在 config.Init 之前填充 WALA_API_KEY / APP_SESSION_SECRET 等环境变量。
	// 从 backend/ 向上查找 ../.env。
	if err := dotenv.Load("../.env"); err != nil {
		fmt.Fprintf(os.Stderr, "load .env warning: %v\n", err)
	}

	// 初始化配置
	cfg, err := config.Init("./config/server")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 创建 DI 容器
	injector := do.New()

	// 注入配置
	do.ProvideValue(injector, cfg)

	// 注册基础设施
	if err := pkg.RegisterInfra(injector); err != nil {
		fmt.Fprintf(os.Stderr, "failed to register infra: %v\n", err)
		os.Exit(1)
	}

	l := do.MustInvoke[*slog.Logger](injector)
	l.With("config", cfg).Debug("print config")

	// 运行数据库迁移
	if err := store.MigrateSQL(cfg, l); err != nil {
		l.Error("failed to migrate database", "error", err)
		os.Exit(1)
	}

	// 注册业务模块（bridal 裁剪版：仅保留登录/授权/订阅/团队/上传/llmproxy 等模块，
	// 剥离 host/vmidle/git/project/task/skill/plugin/mcphub/file 等编码任务执行链路）
	biz.RegisterBridal(injector)
	biz.InvokeBridal(injector)

	// 获取 web 实例并启动服务
	w := do.MustInvoke[*web.Web](injector)
	w.PrintRoutes()
	svc := service.NewService(
		service.WithPprof(),
		service.WithLogger(l),
	)
	svc.Add(&server{w: w, addr: cfg.Server.Addr})

	l.Info("starting server", "addr", cfg.Server.Addr)
	if err := svc.Run(); err != nil {
		l.Error("server error", "error", err)
	}
}

type server struct {
	w    *web.Web
	addr string
}

func (s *server) Name() string { return "MonkeyCode Service" }
func (s *server) Start() error { return s.w.Run(s.addr) }
func (s *server) Stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.w.Echo().Shutdown(ctx)
}
