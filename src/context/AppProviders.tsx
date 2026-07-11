/**
 * AppProviders -- 全局 Provider 聚合
 *
 * 层级：AuthProvider（低频）-> DataProvider（中频）-> CategoryProvider（低频）-> 页面/组件消费。
 * 按变更频率分层，避免高频更新拖垮低频组件。
 */
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { DataProvider } from "./DataContext";
import { CategoryProvider } from "./CategoryContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <CategoryProvider>{children}</CategoryProvider>
      </DataProvider>
    </AuthProvider>
  );
}
