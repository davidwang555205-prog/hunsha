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
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./components/layout/AppShell";
import { AdminLayout } from "./components/layout/AdminLayout";
import { RequireAuth, RequireAdmin } from "./components/auth/RequireAuth";
import { FadeIn } from "./components/motion/FadeIn";
import { Spinner } from "./components/ui/Spinner";

const StudioPage = lazy(() => import("./pages/StudioPage").then((m) => ({ default: m.StudioPage })));
const ToolsHomePage = lazy(() => import("./pages/ToolsHomePage").then((m) => ({ default: m.ToolsHomePage })));
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
const AdminEnginesPage = lazy(() =>
  import("./pages/admin/AdminEnginesPage").then((m) => ({ default: m.AdminEnginesPage }))
);
const AdminModelInvocationsPage = lazy(() =>
  import("./pages/admin/AdminModelInvocationsPage").then((m) => ({ default: m.AdminModelInvocationsPage }))
);
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((m) => ({ default: m.ChangePasswordPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ChangeEmailPage = lazy(() => import("./pages/ChangeEmailPage").then((m) => ({ default: m.ChangeEmailPage })));
const ChangePhonePage = lazy(() => import("./pages/ChangePhonePage").then((m) => ({ default: m.ChangePhonePage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage").then((m) => ({ default: m.AdminSettingsPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-text-muted">
      <Spinner size={28} />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isStudioWorkspace = location.pathname === "/studio";
  return (
    <Suspense fallback={<PageFallback />}>
      <FadeIn direction="up" duration={240} className={isStudioWorkspace ? "h-full" : "flex flex-col gap-8"}>{children}</FadeIn>
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
      <AdminLayout>
        <LazyPage>{children}</LazyPage>
      </AdminLayout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LazyPage><RegisterPage /></LazyPage>} />
        <Route path="/forgot-password" element={<LazyPage><ForgotPasswordPage /></LazyPage>} />
        <Route path="/change-password" element={<RequireAuth><LazyPage><ChangePasswordPage /></LazyPage></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><LazyPage><ProfilePage /></LazyPage></RequireAuth>} />
        <Route path="/profile/email" element={<RequireAuth><LazyPage><ChangeEmailPage /></LazyPage></RequireAuth>} />
        <Route path="/profile/phone" element={<RequireAuth><LazyPage><ChangePhonePage /></LazyPage></RequireAuth>} />
        <Route path="/" element={<Shell><ToolsHomePage /></Shell>} />
        <Route path="/studio" element={<Shell><StudioPage /></Shell>} />
        <Route path="/history" element={<Shell><HistoryPage /></Shell>} />
        <Route path="/admin" element={<AdminShell><AdminPage /></AdminShell>} />
        <Route path="/admin/users" element={<AdminShell><AdminUsersPage /></AdminShell>} />
        <Route path="/admin/history" element={<AdminShell><HistoryPage adminMode /></AdminShell>} />
        <Route path="/admin/model-invocations" element={<AdminShell><AdminModelInvocationsPage /></AdminShell>} />
        <Route path="/admin/channels" element={<AdminShell><AdminChannelsPage /></AdminShell>} />
        <Route path="/admin/categories" element={<AdminShell><AdminCategoriesPage /></AdminShell>} />
        <Route path="/admin/credits" element={<AdminShell><AdminCreditsPage /></AdminShell>} />
        <Route path="/admin/engines" element={<AdminShell><AdminEnginesPage /></AdminShell>} />
        <Route path="/admin/settings" element={<AdminShell><AdminSettingsPage /></AdminShell>} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
