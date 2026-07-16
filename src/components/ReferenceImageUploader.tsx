import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { ImageLightbox, type LightboxImage } from "./ui/ImageLightbox";
import { acceptedReferenceImageTypes, validateReferenceImage } from "../lib/referenceImage";

type ReferenceImageUploaderProps = {
  files?: File[];
  onChange?: (files: File[]) => void;
  /** 上传区标题 */
  label: string;
  /** 上传区副提示（格式/用途说明） */
  hint?: string;
  /** 最大张数 */
  maxCount: number;
  /** 最少张数（配合 required 用于必传校验提示） */
  minCount?: number;
  /** 是否必传：true 时不足 minCount 显示红色提示，标题带 * */
  required?: boolean;
};

export function ReferenceImageUploader({
  files: controlledFiles,
  onChange,
  label,
  hint,
  maxCount,
  minCount,
  required
}: ReferenceImageUploaderProps) {
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState(-1);
  const files = controlledFiles ?? internalFiles;

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file)
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const commitFiles = (nextFiles: File[]) => {
    if (!controlledFiles) {
      setInternalFiles(nextFiles);
    }
    onChange?.(nextFiles);
  };

  const handleSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const checkedFiles = await Promise.all(selectedFiles.map(async (file) => ({ file, error: await validateReferenceImage(file) })));
    const invalid = checkedFiles.find((item) => item.error);
    const validFiles = checkedFiles.filter((item) => !item.error).map((item) => item.file);

    if (invalid?.error) {
      setError(`${invalid.file.name}：${invalid.error}`);
    } else {
      setError("");
    }

    // 累加后超 maxCount 截断（保留先选的），并提示
    let nextFiles = [...files, ...validFiles];
    if (nextFiles.length > maxCount) {
      nextFiles = nextFiles.slice(0, maxCount);
      setError(`最多 ${maxCount} 张，已只保留前 ${maxCount} 张。`);
    }
    commitFiles(nextFiles);
  };

  const removeFile = (targetFile: File) => {
    setError("");
    commitFiles(files.filter((file) => file !== targetFile));
  };

  const lightboxImages: LightboxImage[] = previews.map((preview) => ({ url: preview.url, name: preview.file.name }));

  const notEnough = !!(required && minCount && files.length < minCount);
  const countText = minCount && required
    ? `${files.length}/${maxCount} · 至少 ${minCount} 张`
    : `${files.length}/${maxCount}`;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
        <span className={`text-xs ${notEnough ? "text-danger" : "text-text-muted"}`}>{countText}</span>
      </div>

      {files.length < maxCount && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/70 px-4 py-5 text-center transition hover:border-primary hover:bg-surface">
          <span className="text-sm font-medium text-text">点击上传</span>
          {hint && <span className="mt-1 text-xs leading-5 text-text-muted">{hint}</span>}
          <span className="mt-1 text-xs leading-5 text-text-muted">
            支持 JPG、PNG、WebP 格式，单张不超过 10MB，最多上传 {maxCount} 张。
          </span>
          <input
            className="sr-only"
            type="file"
            accept={acceptedReferenceImageTypes.join(",")}
            multiple={maxCount > 1}
            onChange={handleSelect}
          />
        </label>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      {notEnough && <p className="text-xs text-danger">至少需要 {minCount} 张，请继续上传。</p>}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div key={`${preview.file.name}-${preview.file.lastModified}`} className="overflow-hidden rounded-md bg-surface ring-1 ring-border">
              <button type="button" onClick={() => setPreviewIndex(index)} className="block w-full" aria-label="放大预览">
                <img className="aspect-[4/5] w-full object-cover" src={preview.url} alt={preview.file.name} />
              </button>
              <div className="space-y-2 p-2">
                <p className="truncate text-xs text-text-muted">{preview.file.name}</p>
                <button
                  className="w-full rounded-sm bg-bg px-3 py-2 text-xs font-medium text-text ring-1 ring-border transition hover:bg-primary-50"
                  type="button"
                  onClick={() => removeFile(preview.file)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ImageLightbox
        open={previewIndex >= 0}
        images={lightboxImages}
        index={Math.max(0, previewIndex)}
        onClose={() => setPreviewIndex(-1)}
        onIndexChange={setPreviewIndex}
      />
    </div>
  );
}
