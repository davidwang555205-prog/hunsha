/**
 * NotificationContext -- 本地站内通知（V2）
 *
 * 纯前端 localStorage 实现，不依赖后端站内通知表。
 * 任务完成/失败时写入，右上角铃铛红点 + 弹窗列表展示。
 * 最多保留 50 条，支持标记已读/全部已读/清空。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LocalNotification = {
  id: string;
  type: "success" | "failed" | "info";
  title: string;
  body: string;
  taskId?: string;
  createdAt: string;
  read: boolean;
};

const storageKey = "bridal-content-studio-notifications";
const MAX_NOTIFICATIONS = 50;

type NotificationContextValue = {
  notifications: LocalNotification[];
  unreadCount: number;
  addNotification: (n: Omit<LocalNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<LocalNotification[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as LocalNotification[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {
      // 忽略写入失败
    }
  }, [notifications]);

  const addNotification = useCallback((n: Omit<LocalNotification, "id" | "createdAt" | "read">) => {
    setNotifications((prev) => {
      // 去重：同 taskId + type 不重复写
      if (n.taskId && prev.some((x) => x.taskId === n.taskId && x.type === n.type)) return prev;
      const item: LocalNotification = {
        ...n,
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      return [item, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, unreadCount, addNotification, markRead, markAllRead, clear }),
    [notifications, unreadCount, addNotification, markRead, markAllRead, clear]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications 必须在 <NotificationProvider> 内使用");
  return ctx;
}
