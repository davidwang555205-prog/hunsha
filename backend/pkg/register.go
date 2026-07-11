package pkg

import (
	"log/slog"
	"strings"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/samber/do"

	"bridal/backend/config"
	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/domain"
	"bridal/backend/middleware"
	"bridal/backend/pkg/asr"
	"bridal/backend/pkg/captcha"
	"bridal/backend/pkg/clickhouse"
	"bridal/backend/pkg/delayqueue"
	"bridal/backend/pkg/doubao"
	"bridal/backend/pkg/email"
	"bridal/backend/pkg/lifecycle"
	"bridal/backend/pkg/llm"
	"bridal/backend/pkg/logger"
	"bridal/backend/pkg/loki"
	"bridal/backend/pkg/modelusage"
	"bridal/backend/pkg/msgpush"
	"bridal/backend/pkg/nls"
	"bridal/backend/pkg/notify/channel"
	"bridal/backend/pkg/notify/dispatcher"
	"bridal/backend/pkg/notify/template"
	"bridal/backend/pkg/session"
	"bridal/backend/pkg/store"
	"bridal/backend/pkg/tasker"
	"bridal/backend/pkg/taskflow"
	"bridal/backend/pkg/tasklog"
	"bridal/backend/pkg/ws"
)

// RegisterInfra 注册基础设施依赖
func RegisterInfra(i *do.Injector, w ...*web.Web) error {
	// Logger
	do.Provide(i, func(i *do.Injector) (*slog.Logger, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return logger.NewLogger(&cfg.Logger), nil
	})

	// Redis
	do.Provide(i, func(i *do.Injector) (*redis.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return store.NewRedisCli(cfg), nil
	})

	// Ent DB
	do.Provide(i, func(i *do.Injector) (*db.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		l := do.MustInvoke[*slog.Logger](i)
		return store.NewEntDBV2(cfg, l)
	})

	// Web
	if len(w) > 0 && w[0] != nil {
		do.ProvideValue(i, w[0])
	} else {
		do.Provide(i, func(i *do.Injector) (*web.Web, error) {
			w := web.New()
			return w, nil
		})
	}

	// Captcha
	do.Provide(i, func(i *do.Injector) (*captcha.Captcha, error) {
		return captcha.NewCaptcha(), nil
	})

	do.Provide(i, email.NewSMTPClient)

	// Session
	do.Provide(i, func(i *do.Injector) (*session.Session, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return session.New(cfg), nil
	})

	// Auth Middleware
	do.Provide(i, func(i *do.Injector) (*middleware.AuthMiddleware, error) {
		sess := do.MustInvoke[*session.Session](i)
		l := do.MustInvoke[*slog.Logger](i)
		return middleware.NewAuthMiddleware(sess, nil, l), nil
	})

	// TargetActive Middleware
	do.Provide(i, func(i *do.Injector) (*middleware.TargetActiveMiddleware, error) {
		l := do.MustInvoke[*slog.Logger](i)
		activeRepo := do.MustInvoke[domain.UserActiveRepo](i)
		return middleware.NewTargetActiveMiddleware(l, activeRepo), nil
	})

	// Audit Middleware
	do.Provide(i, func(i *do.Injector) (*middleware.AuditMiddleware, error) {
		l := do.MustInvoke[*slog.Logger](i)
		auditUc := do.MustInvoke[domain.AuditUsecase](i)
		userUc := do.MustInvoke[domain.UserUsecase](i)
		return middleware.NewAuditMiddleware(l, auditUc, userUc), nil
	})

	do.Provide(i, func(i *do.Injector) (taskflow.Clienter, error) {
		cfg := do.MustInvoke[*config.Config](i)
		// bridal: taskflow 为编码任务执行链路依赖，M1 起不启用。
		// 配置为空时返回 nil（taskflow.NewClient 在 TASKFLOW_SERVER 为空时会 panic，
		// 此处提前短路），消费方（biz/team host usecase 等）仅存指针，M1 不调用其方法。
		if strings.TrimSpace(cfg.TaskFlow.GrpcURL) == "" {
			return nil, nil
		}
		l := do.MustInvoke[*slog.Logger](i)
		return taskflow.NewClient(taskflow.WithDebug(cfg.Debug), taskflow.WithLogger(l)), nil
	})

	// Tasker（任务状态机）
	do.Provide(i, func(i *do.Injector) (*tasker.Tasker[*domain.TaskSession], error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return tasker.NewTasker(r, tasker.WithLogger[*domain.TaskSession](l)), nil
	})

	// LLM Client
	do.Provide(i, func(i *do.Injector) (*llm.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return llm.NewClient(llm.Config{
			BaseURL:       cfg.LLM.BaseURL,
			APIKey:        cfg.LLM.APIKey,
			Model:         cfg.LLM.Model,
			InterfaceType: llm.InterfaceType(cfg.LLM.InterfaceType),
		}), nil
	})

	// Loki Client
	do.Provide(i, func(i *do.Injector) (*loki.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return loki.NewClient(cfg.Loki.Addr), nil
	})

	do.Provide(i, func(i *do.Injector) (*clickhouse.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		l := do.MustInvoke[*slog.Logger](i)
		return clickhouse.New(cfg.ClickHouse, l)
	})

	do.Provide(i, func(i *do.Injector) (*modelusage.Recorder, error) {
		clickhouseClient := do.MustInvoke[*clickhouse.Client](i)
		dbClient := do.MustInvoke[*db.Client](i)
		logger := do.MustInvoke[*slog.Logger](i)
		return modelusage.NewRecorder(clickhouseClient, modelusage.NewEntContextRepo(dbClient), logger), nil
	})

	do.Provide(i, func(i *do.Injector) (*tasklog.Gateway, error) {
		lokiClient := do.MustInvoke[*loki.Client](i)
		clickhouseClient := do.MustInvoke[*clickhouse.Client](i)

		return &tasklog.Gateway{
			Loki:       tasklog.NewLokiProvider(lokiClient),
			ClickHouse: tasklog.NewClickHouseProvider(clickhouseClient),
		}, nil
	})

	// TaskSummary Queue
	do.Provide(i, func(i *do.Injector) (*delayqueue.TaskSummaryQueue, error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return delayqueue.NewTaskSummaryQueue(r, l), nil
	})

	// VM Idle Sleep Queue
	do.Provide(i, func(i *do.Injector) (*delayqueue.VMSleepQueue, error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return delayqueue.NewVMSleepQueue(r, l), nil
	})

	// VM Idle Notify Queue
	do.Provide(i, func(i *do.Injector) (*delayqueue.VMNotifyQueue, error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return delayqueue.NewVMNotifyQueue(r, l), nil
	})

	// VM Idle Recycle Queue
	do.Provide(i, func(i *do.Injector) (*delayqueue.VMRecycleQueue, error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return delayqueue.NewVMRecycleQueue(r, l), nil
	})

	// VM Expire Queue（手动创建的 VM 过期队列）
	do.Provide(i, func(i *do.Injector) (*delayqueue.VMExpireQueue, error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		return delayqueue.NewVMExpireQueue(r, l), nil
	})

	// Channel Registry（通知渠道）
	do.Provide(i, func(i *do.Injector) (*msgpush.WechatClient, error) {
		cfg := do.MustInvoke[*config.Config](i)
		l := do.MustInvoke[*slog.Logger](i)
		r := do.MustInvoke[*redis.Client](i)
		return msgpush.NewWechatClient(cfg, l, r), nil
	})
	do.Provide(i, func(i *do.Injector) (*channel.Registry, error) {
		cfg := do.MustInvoke[*config.Config](i)
		wc := do.MustInvoke[*msgpush.WechatClient](i)
		return channel.NewRegistry(
			channel.NewDingTalkSender(),
			channel.NewFeishuSender(),
			channel.NewWeComSender(),
			channel.NewWebhookSender(),
			channel.NewWechatMPSender(cfg, wc),
		), nil
	})

	// Template Registry（通知模板）
	do.Provide(i, func(i *do.Injector) (*template.Registry, error) {
		return template.NewDefaultRegistry(), nil
	})

	// Dispatcher（通知分发器）
	do.Provide(i, func(i *do.Injector) (*dispatcher.Dispatcher, error) {
		return dispatcher.NewDispatcher(i, nil), nil
	})

	// WebSocket TaskConn
	do.Provide(i, func(i *do.Injector) (*ws.TaskConn, error) {
		return ws.NewTaskConn(), nil
	})

	// WebSocket ControlConn
	do.Provide(i, func(i *do.Injector) (*ws.ControlConn, error) {
		return ws.NewControlConn(), nil
	})

	// NLS 语音识别（可选，配置为空时不注册）—— 仅供一段录音 POST 接口使用
	do.Provide(i, func(i *do.Injector) (*nls.NLS, error) {
		cfg := do.MustInvoke[*config.Config](i)
		if cfg.NLS.AppKey == "" || cfg.NLS.AkID == "" || cfg.NLS.AkKey == "" {
			return nil, nil
		}
		l := do.MustInvoke[*slog.Logger](i)
		r := do.MustInvoke[*redis.Client](i)
		return nls.NewNLS(cfg, l, r), nil
	})

	// 豆包流式 ASR（可选，配置为空时不注册）—— 流式 WS 接口使用
	// 通过 asr.Transcriber interface 暴露,handler 不依赖具体厂商。
	do.Provide(i, func(i *do.Injector) (asr.Transcriber, error) {
		cfg := do.MustInvoke[*config.Config](i)
		l := do.MustInvoke[*slog.Logger](i)
		d := doubao.NewDoubao(cfg, l)
		if d == nil {
			return nil, nil
		}
		return d, nil
	})

	// 任务生命周期管理
	do.Provide(i, func(i *do.Injector) (*lifecycle.Manager[uuid.UUID, consts.TaskStatus, lifecycle.TaskMetadata], error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)

		lc := lifecycle.NewManager(
			r,
			lifecycle.WithLogger[uuid.UUID, consts.TaskStatus, lifecycle.TaskMetadata](l),
			lifecycle.WithTransitions[uuid.UUID, consts.TaskStatus, lifecycle.TaskMetadata](lifecycle.TaskTransitions()),
		)

		lc.Register(
			lifecycle.NewTaskCreateHook(i, lc),
			lifecycle.NewTaskNotifyHook(i),
		)

		return lc, nil
	})

	do.Provide(i, func(i *do.Injector) (*lifecycle.Manager[string, lifecycle.VMState, lifecycle.VMMetadata], error) {
		r := do.MustInvoke[*redis.Client](i)
		l := do.MustInvoke[*slog.Logger](i)
		lc := lifecycle.NewManager(
			r,
			lifecycle.WithLogger[string, lifecycle.VMState, lifecycle.VMMetadata](l),
			lifecycle.WithTransitions[string, lifecycle.VMState, lifecycle.VMMetadata](lifecycle.VMTransitions()),
		)

		lc.Register(
			lifecycle.NewVMTaskHook(i),
			lifecycle.NewVMRecycleHook(i),
		)

		return lc, nil
	})

	return nil
}
