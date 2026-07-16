/**
 * titles -- 标题备选的存取工具
 *
 * 生成页 contentPreview.titles 是「标题备选」数组（通常 3 个），提交时 join("\n")
 * 存进后端单个 title 字段（后端 title 纯展示用，不参与 prompt 拼装）。显示层用这俩
 * 函数还原：splitTitles 拿全部备选，firstTitle 拿首个（列表卡片/通知/下载文件名等
 * 只展示一行标题的场景）。
 */

/** 把后端 title（\n 分隔）拆成标题数组；空串/全空白返回 [] */
export function splitTitles(title: string): string[] {
  return title
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** 取首个标题；用于列表卡片/通知/下载文件名等只展示一行标题的场景，兜底返回原串 trim */
export function firstTitle(title: string): string {
  return splitTitles(title)[0] ?? title.trim();
}
