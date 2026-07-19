/**
 * GenerationLoadingState -- 工作台右侧交付区的生成中动画。
 *
 * 不依赖真实 GIF 文件：CSS 动画能够随系统的“减少动态效果”偏好自动降级，
 * 并且不会在网络慢时产生额外资源请求。视觉上作为整张输出卡片的等待态，
 * 等首张任务结果回传后由 ImageGenerationGrid 无缝替换。
 */
type GenerationLoadingStateProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

export function GenerationLoadingState({
  title = "AI 正在绘制这组视觉内容",
  description = "任务会在这里逐张显现，请保持页面开启。",
  compact = false
}: GenerationLoadingStateProps) {
  return (
    <div
      className={`generation-loading-state ${compact ? "min-h-[190px]" : "min-h-[340px]"}`}
      role="status"
      aria-live="polite"
    >
      <div className="generation-loading-orbit" aria-hidden>
        <span className="generation-loading-petal generation-loading-petal-one" />
        <span className="generation-loading-petal generation-loading-petal-two" />
        <span className="generation-loading-petal generation-loading-petal-three" />
        <span className="generation-loading-core">✦</span>
      </div>
      <div className="mt-6 flex items-center gap-2" aria-hidden>
        <span className="generation-loading-dot" />
        <span className="generation-loading-dot" />
        <span className="generation-loading-dot" />
      </div>
      <p className="mt-3 text-sm font-semibold text-text">{title}</p>
      <p className="mt-1 max-w-xs text-center text-xs leading-5 text-text-muted">{description}</p>
    </div>
  );
}
