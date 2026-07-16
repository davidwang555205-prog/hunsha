/**
 * ReadOnlyReferenceImages -- 恢复任务时只读回显用户上传的参考图
 *
 * 任务结束（完成/失败/取消）后重新进入页面，本地 File 已丢失，改用后端存的
 * referenceImages（kind=scene/product）只读展示。点击可放大预览。
 * 点「新任务」reset 后本组件卸载，回到 ReferenceImageUploader 上传态。
 */
import { useState } from "react";
import type { GeneratedImage } from "../../types/api";
import { ImageLightbox, type LightboxImage } from "../ui/ImageLightbox";

type ReadOnlyReferenceImagesProps = {
  images: GeneratedImage[];
};

export function ReadOnlyReferenceImages({ images }: ReadOnlyReferenceImagesProps) {
  const [previewIndex, setPreviewIndex] = useState(-1);

  // kind=scene 为场景参考图；product 及旧记录无 kind 兜底为产品图
  const sceneImages = images.filter((img) => img.kind === "scene");
  const productImages = images.filter((img) => img.kind !== "scene");

  // 拼成全局列表供 lightbox 连续切换：scene 在前，product 接续
  const all = [...sceneImages, ...productImages];
  const lightboxImages: LightboxImage[] = all.map((img) => ({
    url: img.url,
    name: img.name,
    downloadUrl: img.downloadUrl
  }));

  const renderGroup = (label: string, list: GeneratedImage[], startIndex: number) => {
    if (!list.length) return null;
    return (
      <div>
        <span className="text-sm font-medium text-text">{label}</span>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((img, i) => (
            <div key={img.id} className="overflow-hidden rounded-md bg-surface ring-1 ring-border">
              <button
                type="button"
                onClick={() => setPreviewIndex(startIndex + i)}
                className="block w-full"
                aria-label="放大预览"
              >
                <img
                  className="aspect-[4/5] w-full object-cover"
                  src={img.url}
                  alt={img.name ?? "参考图"}
                  loading="lazy"
                />
              </button>
              <div className="p-2">
                <p className="truncate text-xs text-text-muted">{img.name ?? "参考图"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <p className="mb-4 text-sm text-text-muted">本次任务使用的参考图（只读，点「新任务」可重新上传）。</p>
      <div className="space-y-5">
        {renderGroup("场景参考图", sceneImages, 0)}
        {renderGroup("婚纱产品图", productImages, sceneImages.length)}
      </div>

      <ImageLightbox
        open={previewIndex >= 0}
        images={lightboxImages}
        index={Math.max(0, previewIndex)}
        onClose={() => setPreviewIndex(-1)}
        onIndexChange={setPreviewIndex}
      />
    </>
  );
}
