export const acceptedReferenceImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxReferenceImageSize = 10 * 1024 * 1024;

/** 在上传阶段确认浏览器能够实际解码图片，避免只依赖可伪造的 MIME 类型。 */
export async function validateReferenceImage(file: File): Promise<string | null> {
  if (!acceptedReferenceImageTypes.includes(file.type as (typeof acceptedReferenceImageTypes)[number])) {
    return "请上传 JPG、PNG 或 WebP 图片。";
  }
  if (file.size === 0) {
    return "这张图片是空文件，请重新选择。";
  }
  if (file.size > maxReferenceImageSize) {
    return "单张图片不能超过 10MB，请压缩后再上传。";
  }

  const objectURL = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve() : reject(new Error("invalid dimensions"));
      image.onerror = () => reject(new Error("decode failed"));
      image.src = objectURL;
    });
    return null;
  } catch {
    return "暂时无法读取这张图片，请重新保存为 JPG、PNG 或 WebP 后再上传。";
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}
