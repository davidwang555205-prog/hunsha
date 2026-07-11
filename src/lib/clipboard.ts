/** 复制文本到剪贴板 */
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
