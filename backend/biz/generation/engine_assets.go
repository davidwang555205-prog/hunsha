package generation

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"bridal/backend/biz/generation/prompt"
)

const defaultEngineKey = "bridal"

// resolveImagePromptEngine 按请求类目的 engine 路由生图提示词素材。
// 未传 categoryId 的存量请求才兼容回退默认 bridal；已传类目必须存在且启用，
// 否则不能静默套用其他类目的 imagePrompt。
func (u *Usecase) resolveImagePromptEngine(ctx context.Context, categoryID uuid.UUID) (string, error) {
	if categoryID == uuid.Nil {
		return defaultEngineKey, nil
	}
	category, err := u.repo.GetCategoryEngine(ctx, categoryID)
	if err != nil {
		return "", fmt.Errorf("读取所选类目失败: %w", err)
	}
	if category == nil || !category.IsEnabled {
		return "", fmt.Errorf("所选内容类目不可用")
	}
	if engineKey := strings.TrimSpace(category.Engine); engineKey != "" {
		return engineKey, nil
	}
	return defaultEngineKey, nil
}

// loadImagePromptAssets 拉取指定内容引擎的 imagePrompt 素材配置。
// 无 imagePrompt 时仍由 prompt.MergeAssets 降级代码默认；但配置的引擎不存在或禁用时
// 返回错误，避免将一个类目的请求静默套到另一个类目。
func (u *Usecase) loadImagePromptAssets(ctx context.Context, engineKey string) (*prompt.Assets, error) {
	if u.engines == nil {
		return nil, fmt.Errorf("内容引擎服务不可用")
	}
	rec, err := u.engines.GetByKey(ctx, engineKey)
	if err != nil {
		u.logger.ErrorContext(ctx, "load image prompt assets: get engine failed", "engineKey", engineKey, "error", err)
		return nil, fmt.Errorf("读取内容引擎 %q 失败: %w", engineKey, err)
	}
	if rec == nil || !rec.IsEnabled {
		return nil, fmt.Errorf("内容引擎 %q 不可用", engineKey)
	}
	return prompt.ParseAssetsFromConfig(rec.Config), nil
}
