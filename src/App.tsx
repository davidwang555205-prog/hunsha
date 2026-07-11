/**
 * App -- 路由壳（V2）
 *
 * BrowserRouter + Routes + 守卫。页面用 React.lazy 懒加载减小首屏。
 * 路由切换用 FadeIn 过渡（240ms）。登录页直出（首屏优先）。
 * 全局 AppProviders 在 main.tsx 注入。
 *
 * 路由结构：
 *   /login                 登录页
 *   /                      内容生成（默认类目）
 *   /history               历史记录（分页）
 *   /admin                 管理后台 dashboard
 *   /admin/users           用户管理
 *   /admin/channels        模型线路管理
 *   /admin/categories      类目管理
 *   /admin/credits         积分记录
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireAdmin } from "./components/auth/RequireAuth";
import { FadeIn } from "./components/motion/FadeIn";
import { Spinner } from "./components/ui/Spinner";

const StudioPage = lazy(() => import("./pages/StudioPage").then((m) => ({ default: m.StudioPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const AdminPage = lazy(() => import("./pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const AdminChannelsPage = lazy(() =>
  import("./pages/admin/AdminChannelsPage").then((m) => ({ default: m.AdminChannelsPage }))
);
const AdminCategoriesPage = lazy(() =>
  import("./pages/admin/AdminCategoriesPage").then((m) => ({ default: m.AdminCategoriesPage }))
);
const AdminCreditsPage = lazy(() =>
  import("./pages/admin/AdminCreditsPage").then((m) => ({ default: m.AdminCreditsPage }))
);

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-text-muted">
      <Spinner size={28} />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FadeIn direction="up" duration={240}>{children}</FadeIn>
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>
        <LazyPage>{children}</LazyPage>
      </AppShell>
    </RequireAuth>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <AppShell>
        <LazyPage>{children}</LazyPage>
      </AppShell>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Shell><StudioPage /></Shell>} />
        <Route path="/history" element={<Shell><HistoryPage /></Shell>} />
        <Route path="/admin" element={<AdminShell><AdminPage /></AdminShell>} />
        <Route path="/admin/users" element={<AdminShell><AdminUsersPage /></AdminShell>} />
        <Route path="/admin/channels" element={<AdminShell><AdminChannelsPage /></AdminShell>} />
        <Route path="/admin/categories" element={<AdminShell><AdminCategoriesPage /></AdminShell>} />
        <Route path="/admin/credits" element={<AdminShell><AdminCreditsPage /></AdminShell>} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
