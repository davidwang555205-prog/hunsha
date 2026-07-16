import type { GeneratedImage } from "../types/api";

/** 将页面展示名称转换为可跨系统保存的文件名，保留原文，仅替换文件系统禁用字符。 */
function safeFilenameStem(name?: string) {
  const stem = (name || "generated-image").trim().replace(/[\\/:*?"<>|]/g, "-");
  return stem || "generated-image";
}

/** 扩展名兜底：jpeg -> jpg，缺省 png。 */
function blobExt(blob: Blob): string {
  const sub = blob.type.split("/")[1] || "png";
  return sub.replace("jpeg", "jpg");
}

/** 下载文件名和页面显示名称保持一致。 */
export function buildImageDownloadName(name: string | undefined, blob: Blob) {
  return `${safeFilenameStem(name)}.${blobExt(blob)}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function fetchImageBlob(image: GeneratedImage) {
  const response = await fetch(image.downloadUrl);
  if (!response.ok) throw new Error("图片下载失败，请稍后重试。");
  return response.blob();
}

/** 下载单张生成图，文件名使用页面展示名称。 */
export async function downloadImage(image: GeneratedImage, displayName = image.name) {
  const blob = await fetchImageBlob(image);
  triggerDownload(blob, buildImageDownloadName(displayName, blob));
}

/** 批量逐张下载，不打包为 ZIP；若页面名称重复，仅为后续文件追加序号避免覆盖。 */
export async function downloadImages(images: GeneratedImage[]) {
  const usedNames = new Set<string>();
  for (const image of images) {
    const blob = await fetchImageBlob(image);
    const baseName = buildImageDownloadName(image.name, blob);
    let filename = baseName;
    let duplicateIndex = 2;
    while (usedNames.has(filename)) {
      const extensionIndex = baseName.lastIndexOf(".");
      filename = `${baseName.slice(0, extensionIndex)}-${duplicateIndex}${baseName.slice(extensionIndex)}`;
      duplicateIndex++;
    }
    usedNames.add(filename);
    triggerDownload(blob, filename);
  }
}
