/** 日期格式化：zh-CN 月/日 时:分 */
export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

/**
 * 取用户展示名（昵称）：优先 displayName/name，但 name 若等同 email（批量建成员时 name=email，无独立昵称）
 * 则降级到 username，再降级到 email 前缀。避免昵称与邮箱重复显示成两行 email。
 */
export function pickUserLabel(opts: {
  displayName?: string;
  name?: string;
  username?: string;
  email?: string;
}): string {
  const { displayName, name, username, email } = opts;
  const nick = displayName || name;
  if (nick && nick !== email) return nick;
  if (username && username !== email) return username;
  return (email || "").split("@")[0];
}
