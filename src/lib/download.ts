import type { GeneratedImage } from "../types/api";

/** 下载单张生成图（fetch blob -> 触发 a.download） */
export async function downloadImage(image: GeneratedImage, title: string) {
  const response = await fetch(image.downloadUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${title || "generated-image"}.png`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/** 批量下载（串行，文件名追加序号） */
export async function downloadImages(images: GeneratedImage[], title: string) {
  for (const [index, image] of images.entries()) {
    await downloadImage(image, `${title}-${index + 1}`);
  }
}
