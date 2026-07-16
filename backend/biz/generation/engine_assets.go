package generation

import (
	"context"

	"bridal/backend/biz/generation/prompt"
)

// loadImagePromptAssets 拉取当前内容引擎的 imagePrompt 素材配置。
// 当前单引擎（bridal，key 由 engines.SeedDefault 插入）：失败/禁用/无配置返回 nil，
// 由 prompt.MergeAssets 降级到 prompt.DefaultAssets（永不阻塞生图）。
// TODO 多引擎：按 task.CategoryID -> category.engine 路由 engineKey。
func (u *Usecase) loadImagePromptAssets(ctx context.Context) *prompt.Assets {
	if u.engines == nil {
		return nil
	}
	engineKey := "bridal"
	rec, err := u.engines.GetByKey(ctx, engineKey)
	if err != nil {
		u.logger.ErrorContext(ctx, "load image prompt assets: get engine failed", "engineKey", engineKey, "error", err)
		return nil
	}
	if rec == nil || !rec.IsEnabled {
		return nil
	}
	return prompt.ParseAssetsFromConfig(rec.Config)
}
