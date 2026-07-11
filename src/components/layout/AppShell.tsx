/**
 * AppShell -- 全局布局壳（苹果风格）
 *
 * AppHeader（顶栏）+ 主内容区最大宽度 1280px 居中 + 响应式 gutter。
 * 路由页面用 FadeIn 包裹做 240ms 切换过渡。
 */
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <main className="px-4 py-6 text-text sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
