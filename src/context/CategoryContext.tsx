/**
 * CategoryContext -- 当前类目状态
 *
 * 管理当前选中的类目 id，持久化到 localStorage。
 * 类目列表由 DataContext 或独立请求加载，此处只管"当前选中"。
 * 默认类目由后端 categories 接口返回的第一项决定。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listCategories } from "../api/admin";
import { useAuth } from "./AuthContext";
import type { Category } from "../types/api";

const storageKey = "bridal-content-studio-category";

type CategoryContextValue = {
  categories: Category[];
  currentCategory: Category | null;
  currentCategoryId: string | null;
  setCurrentCategoryId: (id: string) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => window.localStorage.getItem(storageKey));
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const payload = await listCategories();
      setCategories(payload.categories);
      setCurrentId((prev) => {
        const exists = payload.categories.some((c) => c.id === prev);
        if (exists) return prev;
        return payload.categories[0]?.id ?? null;
      });
    } catch {
      // 401 由 client 统一处理
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      // 数据初始化加载：需在 effect 内 fetch + setState（与 DataContext 一致）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    } else {
      setCategories([]);
    }
  }, [isAuthenticated, refresh]);

  const setCurrentCategoryId = useCallback((id: string) => {
    setCurrentId(id);
    window.localStorage.setItem(storageKey, id);
  }, []);

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === currentId) ?? categories[0] ?? null,
    [categories, currentId]
  );

  const value = useMemo<CategoryContextValue>(
    () => ({
      categories,
      currentCategory,
      currentCategoryId: currentCategory?.id ?? null,
      setCurrentCategoryId,
      isLoading,
      refresh
    }),
    [categories, currentCategory, setCurrentCategoryId, isLoading, refresh]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategory() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error("useCategory 必须在 <CategoryProvider> 内使用");
  return ctx;
}
