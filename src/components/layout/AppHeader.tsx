/**
 * AppHeader -- 右侧 TopBar（三件套：积分 / 通知 / 头像）
 *
 * 左侧 sidebar 导航在 BaseLayout。本组件只承载右上角三件套：
 *   - 积分：点击弹窗（余额 + 消耗明细）
 *   - 通知：铃铛 + 红点，弹窗本地通知列表
 *   - 头像：弹窗（用户信息 + 个人中心 + 管理后台入口[admin] + 退出登录）
 * z-index 走 token：header(z-header) / popover(z-popover) / 外部点击遮罩(z-dropdown)。
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { listCreditTransactions, listCustomerServicePublic } from "../../api/admin";
import { getCreditBalance } from "../../api/credits";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CustomerServiceIcon } from "../icons";
import type { CreditTransaction, CustomerService } from "../../types/api";
import logo from "../../assets/logo.png";

type PopoverKey = "credits" | "notify" | "service" | "avatar" | null;

export function AppHeader() {
  const { user, refreshUser, logout, isAdmin } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, clear } = useNotifications();
  const navigate = useNavigate();
  const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
  const [csList, setCsList] = useState<CustomerService[]>([]);
  const [csLoaded, setCsLoaded] = useState(false);
  const [selectedCs, setSelectedCs] = useState<CustomerService | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const credits = user?.credits ?? 0;
  const accountLabel = user?.email || user?.phone || user?.username || "未绑定账号";

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

  // 首次打开客服弹窗时拉取生效客服列表（登录用户可见）
  const loadCustomerServices = () => {
    if (csLoaded) return;
    listCustomerServicePublic()
      .then((r) => {
        setCsList(r.customerService);
        setCsLoaded(true);
      })
      .catch(() => {
        setCsLoaded(true);
      });
  };

  const goto = (path: string) => {
    setOpenPopover(null);
    navigate(path);
  };

  const handleLogout = () => {
    setOpenPopover(null);
    logout();
    navigate("/login");
  };

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

          {/* 客服：通知 icon 后入口，下拉列出生效客服，点击弹详情 Modal */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                loadCustomerServices();
                toggle("service");
              }}
              className="relative flex items-center rounded-full p-2 text-text-muted transition duration-fast ease-out hover:bg-bg hover:text-text"
              aria-label="客服"
            >
              <CustomerServiceIcon size={20} />
            </button>
            {openPopover === "service" && (
              <div className="absolute right-0 top-full z-popover mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-medium text-text">联系客服</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {csList.length === 0 ? (
                    <p className="py-10 text-center text-xs text-text-subtle">暂无在线客服</p>
                  ) : (
                    csList.map((cs) => (
                      <button
                        key={cs.id}
                        type="button"
                        onClick={() => {
                          setSelectedCs(cs);
                          setOpenPopover(null);
                        }}
                        className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left transition hover:bg-bg last:border-0"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                          <CustomerServiceIcon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text">{cs.nickname}</span>
                          {cs.wechatId && <span className="block truncate text-xs text-text-muted">微信号：{cs.wechatId}</span>}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 头像：弹窗（用户信息 + 管理后台[admin] + 退出登录） */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("avatar")}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15 transition duration-fast ease-out hover:ring-primary/40"
              aria-label="用户菜单"
              aria-expanded={openPopover === "avatar"}
            >
              <img src={user?.avatar_url || logo} alt="用户头像" className="h-full w-full object-cover" />
            </button>
            {openPopover === "avatar" && (
              <div className="absolute right-0 top-full z-popover mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                {/* 用户区：点击进入个人中心 */}
                <button
                  type="button"
                  onClick={() => goto("/profile")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15">
                    <img src={user?.avatar_url || logo} alt="用户头像" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{user?.displayName || user?.name || "未设置昵称"}</span>
                    <span className="block truncate text-xs text-text-muted">{accountLabel}</span>
                  </span>
                </button>

                {isAdmin && (
                  <>
                    <div className="border-t border-border/60" />
                    <button
                      type="button"
                      onClick={() => goto("/admin")}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text transition hover:bg-bg"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-text-muted">
                        <path d="M2 6.5 8 2l6 4.5M3.5 6v7h9V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      管理后台
                    </button>
                  </>
                )}

                <div className="border-t border-border/60" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger transition hover:bg-bg"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <path d="M6 3H3.5v10H6M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 客服详情对话框 */}
      {selectedCs && (
        <Modal open={!!selectedCs} onClose={() => setSelectedCs(null)} title={selectedCs.nickname} size="sm">
          <div className="flex flex-col items-center gap-3 py-2">
            {selectedCs.qrcodeUrl ? (
              <img
                src={selectedCs.qrcodeUrl}
                alt={`${selectedCs.nickname} 微信二维码`}
                className="max-h-72 max-w-full rounded-lg border border-border object-contain"
              />
            ) : (
              <p className="text-sm text-text-subtle">暂未上传微信二维码</p>
            )}
            <p className="text-xs text-text-muted">微信扫一扫，添加客服咨询</p>
            <div className="w-full space-y-2 pt-1 text-sm">
              {selectedCs.phone && (
                <div className="flex items-center justify-between rounded-md bg-bg px-3 py-2">
                  <span className="text-text-muted">电话</span>
                  <span className="font-medium text-text">{selectedCs.phone}</span>
                </div>
              )}
              {selectedCs.wechatId && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2">
                  <span className="text-text-muted">微信号</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-text">{selectedCs.wechatId}</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => void navigator.clipboard?.writeText(selectedCs.wechatId)}
                    >
                      复制
                    </Button>
                  </span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 点击外部关闭弹窗（z-dropdown 低于 header z-header） */}
      {openPopover && <div className="fixed inset-0 z-dropdown" onClick={() => setOpenPopover(null)} />}
    </>
  );
}
