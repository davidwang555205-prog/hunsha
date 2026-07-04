import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type ReferenceImageUploaderProps = {
  onChange?: (files: File[]) => void;
};

const maxFileSize = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export function ReferenceImageUploader({ onChange }: ReferenceImageUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

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
    setFiles(nextFiles);
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
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-aura-sand bg-white/70 px-4 py-5 text-center transition hover:border-aura-clay hover:bg-white">
        <span className="text-sm font-medium text-aura-charcoal">上传参考图</span>
        <span className="mt-1 text-xs leading-5 text-aura-muted">jpg / png / webp，单张 10MB 内。本地预览，不上传服务器。</span>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleSelect} />
      </label>

      <p className="rounded-[14px] bg-aura-cream px-3 py-2 text-xs leading-5 text-aura-muted ring-1 ring-aura-beige/70">
        Demo 阶段仅用于预览，暂未接入真实生图 API。
      </p>

      {error && <p className="text-xs text-[#9a4b43]">{error}</p>}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview) => (
            <div key={`${preview.file.name}-${preview.file.lastModified}`} className="overflow-hidden rounded-[16px] bg-white ring-1 ring-aura-beige">
              <img className="aspect-[4/5] w-full object-cover" src={preview.url} alt={preview.file.name} />
              <div className="space-y-2 p-2">
                <p className="truncate text-xs text-aura-muted">{preview.file.name}</p>
                <button
                  className="w-full rounded-[12px] bg-aura-cream px-3 py-2 text-xs font-medium text-aura-charcoal ring-1 ring-aura-beige transition hover:bg-aura-beige"
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
