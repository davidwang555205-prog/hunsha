import type { GeneratedImage } from "../types/api";

/**
 * 历史数据兜底：把各种历史格式的展示名统一规范为 "图N-brief" / "图N"。
 *
 * 后端 buildDisplayImageName 已改为 "图N-brief" 新格式（半角连字符），
 * 但 DB 里仍存历史长名：
 *   - "图N|brief|purpose"（半角竖线，旧 buildDisplayImageName 产物）
 *   - "图N｜brief｜purpose"（全角竖线，旧默认草稿硬编码）
 *   - "图N|brief"（purpose 缺失时的旧产物）
 *
 * 本函数防御性兜底这些历史数据：
 *   - 已是 "图N-brief" 新格式：原样返回；
 *   - 含 "|" / "｜" 的历史名：切分取前两段拼成 "图N-brief"（brief 为空时取 "图N" 裸名）；
 *   - 完全不识别：返回 "图{index+1}"。
 *
 * 下载文件名与展示名共用它，保证用户看到的 / 下载到的名字一致。
 */
export function normalizeImageDisplayName(name: string | undefined, index: number): string {
  const fallback = `图${index + 1}`;
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  // 历史格式：含半角 "|" 或全角 "｜"
  if (trimmed.includes("|") || trimmed.includes("｜")) {
    const parts = trimmed.split(/[|｜]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return fallback;
    const head = parts[0]; // "图N"
    const brief = parts[1]; // 可能不存在
    // 验证 head 是 "图N" 形式，否则直接走兜底
    if (!/^图\d+$/.test(head)) return fallback;
    if (!brief) return head;
    return `${head}-${brief}`;
  }

  // 已是新格式 "图N-brief" 或 "图N"：原样返回
  if (/^图\d+(-.+)?$/.test(trimmed)) return trimmed;

  // 其他自定义名（不识别）：原样返回，尊重用户/蓝图自定义
  return trimmed;
}

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

/** 下载单张生成图，文件名使用 normalizeImageDisplayName 兜底后的展示名。 */
export async function downloadImage(image: GeneratedImage, displayName?: string, index = 0) {
  const blob = await fetchImageBlob(image);
  const normalized = normalizeImageDisplayName(displayName ?? image.name, index);
  triggerDownload(blob, buildImageDownloadName(normalized, blob));
}

/** 批量逐张下载，不打包为 ZIP；每张先走 normalizeImageDisplayName 兜底，重名仅为后续文件追加序号避免覆盖。 */
export async function downloadImages(images: GeneratedImage[]) {
  const usedNames = new Set<string>();
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const blob = await fetchImageBlob(image);
    const normalized = normalizeImageDisplayName(image.name, i);
    const baseName = buildImageDownloadName(normalized, blob);
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
