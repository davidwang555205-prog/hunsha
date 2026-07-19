/**
 * AppHeader -- 右侧 TopBar（三件套：积分 / 通知 / 头像）
 *
 * 左侧 sidebar 导航在 BaseLayout。本组件只承载右上角三件套：
 *   - 积分：点击弹窗（余额 + 消耗明细）
 *   - 通知：铃铛 + 红点，弹窗本地通知列表
 *   - 头像：弹窗（昵称 + 额度 + 后台管理入口[admin] + 退出登录）
 * z-index 走 token：header(z-header) / popover(z-popover) / 外部点击遮罩(z-dropdown)。
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { listCreditTransactions } from "../../api/admin";
import { getCreditBalance } from "../../api/credits";
import { ShieldIcon } from "../icons";
import { Button } from "../ui/Button";
import type { CreditTransaction } from "../../types/api";
import logo from "../../assets/logo.png";

type PopoverKey = "credits" | "notify" | "user" | null;

export function AppHeader() {
  const { user, isAdmin, logout, refreshUser } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, clear } = useNotifications();
  const navigate = useNavigate();
  const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const credits = user?.credits ?? 0;
  const displayName = user?.displayName ?? "用户";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // 打开积分弹窗时拉余额 + 明细
  useEffect(() => {
    if (openPopover !== "credits") return;
    getCreditBalance()
      .then((r) => {
        setBalance(r.balance);
        // 回写 user.credits：/status 是登录 session 快照不实时，弹窗拉到实时 balance 后同步外层按钮数字
        if (user && r.balance !== user.credits) {
          refreshUser({ ...user, credits: r.balance });
        }
      })
      .catch(() => {});
    listCreditTransactions()
      .then((r) => setTransactions(r.transactions))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopover]);

  const toggle = (key: PopoverKey) => setOpenPopover((cur) => (cur === key ? null : key));

  return (
    <>
      <header className="sticky top-0 z-header border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-end gap-1.5 px-6">
          {/* 积分 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("credits")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text transition duration-fast ease-out hover:bg-bg"
              aria-label="积分"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 4.5v7M6 6.5h3a1.5 1.5 0 010 3H6.5a1.5 1.5 0 000 3H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{credits}</span>
            </button>
            {openPopover === "credits" && (
              <div className="absolute right-0 top-full z-popover mt-2 w-72 rounded-xl border border-border bg-surface p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">积分余额</span>
                  <span className="text-2xl font-bold text-primary">{balance ?? credits}</span>
                </div>
                <div className="brand-scrollbar mt-3 max-h-64 overflow-y-auto pr-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">消耗明细</p>
                  {transactions.length === 0 ? (
                    <p className="py-6 text-center text-xs text-text-subtle">暂无明细</p>
                  ) : (
                    transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-text">{t.description || t.type}</p>
                          <p className="text-xs text-text-subtle">{new Date(t.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`ml-2 shrink-0 font-medium ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                          {t.amount >= 0 ? "+" : ""}
                          {t.amount}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 通知 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("notify")}
              className="relative flex items-center rounded-full p-2 text-text-muted transition duration-fast ease-out hover:bg-bg hover:text-text"
              aria-label="消息通知"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2a4.5 4.5 0 00-4.5 4.5V9l-1.5 2.25h12L13.5 9V6.5A4.5 4.5 0 009 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M7.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {openPopover === "notify" && (
              <div className="absolute right-0 top-full z-popover mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-medium text-text">消息通知</span>
                  <div className="flex gap-3">
                    <Button variant="link" size="sm" onClick={markAllRead}>全部已读</Button>
                    <Button variant="link" size="sm" onClick={clear}>清空</Button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-10 text-center text-xs text-text-subtle">暂无通知</p>
                  ) : (
                    notifications.map((n) => (
                      <button key={n.id} type="button" onClick={() => { markRead(n.id); if (n.taskId) { setOpenPopover(null); navigate(`/history?taskId=${encodeURIComponent(n.taskId)}`); } }} className="block w-full border-b border-border/50 px-4 py-3 text-left transition hover:bg-bg last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-text-subtle/40" : "bg-primary"}`} />
                          <span className="text-sm font-medium text-text">{n.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{n.body}</p>
                        <p className="mt-1 text-[11px] text-text-subtle">{new Date(n.createdAt).toLocaleString()}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 头像 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("user")}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15 transition duration-fast ease-out hover:ring-primary/40"
              aria-label="用户菜单"
            >
              <img src={logo} alt="默认用户头像" className="h-full w-full object-cover" />
            </button>
            {openPopover === "user" && (
              <div className="absolute right-0 top-full z-popover mt-2 w-56 rounded-xl border border-border bg-surface p-4 shadow-lg">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15">
                    <img src={logo} alt="默认用户头像" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{displayName}</p>
                    <p className="truncate text-xs text-text-subtle">@{user?.username}</p>
                  </div>
                </div>
                <div className="py-2 text-xs text-text-muted">
                  {isAdmin ? <p>管理员 · 生图不限量</p> : <p>每日额度 {user?.dailyImageLimit ?? 0} 张 · 积分 {credits}</p>}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopover(null);
                      navigate("/admin");
                    }}
                    className="mb-2 flex w-full items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
                  >
                    <ShieldIcon size={16} />
                    进入后台管理
                  </button>
                )}
                <Button variant="danger" block onClick={handleLogout}>
                  退出登录
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 点击外部关闭弹窗（z-dropdown 低于 header z-header） */}
      {openPopover && <div className="fixed inset-0 z-dropdown" onClick={() => setOpenPopover(null)} />}
    </>
  );
}
