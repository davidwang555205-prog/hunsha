import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type ReferenceImageUploaderProps = {
  files?: File[];
  onChange?: (files: File[]) => void;
};

const maxFileSize = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export function ReferenceImageUploader({ files: controlledFiles, onChange }: ReferenceImageUploaderProps) {
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
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

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    const validFiles = selectedFiles.filter((file) => acceptedTypes.includes(file.type) && file.size <= maxFileSize);

    if (validFiles.length !== selectedFiles.length) {
      setError("仅支持 jpg / png / webp，单张不超过 10MB。");
    } else {
      setError("");
    }

    commitFiles([...files, ...validFiles]);
    event.currentTarget.value = "";
  };

  const removeFile = (targetFile: File) => {
    setError("");
    commitFiles(files.filter((file) => file !== targetFile));
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/70 px-4 py-5 text-center transition hover:border-primary hover:bg-surface">
        <span className="text-sm font-medium text-text">上传参考图</span>
        <span className="mt-1 text-xs leading-5 text-text-muted">jpg / png / webp，单张 10MB 内，最多取前 4 张参与生成。</span>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleSelect} />
      </label>

      <p className="rounded-md bg-bg px-3 py-2 text-xs leading-5 text-text-muted ring-1 ring-border/70">
        上传后可预览，生成时由服务端提交到生图接口。
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview) => (
            <div key={`${preview.file.name}-${preview.file.lastModified}`} className="overflow-hidden rounded-md bg-surface ring-1 ring-border">
              <img className="aspect-[4/5] w-full object-cover" src={preview.url} alt={preview.file.name} />
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
    </div>
  );
}
