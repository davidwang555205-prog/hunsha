/**
 * API client -- fetch 统一封装
 *
 * 职责（替代 App.tsx 内联 apiRequest）：
 * 1. token 注入：从注入的 getToken() 取值（非闭包变量），避免并发读到旧值
 * 2. AbortController：每次请求可取消，超时自动 abort
 * 3. 超时：默认 30s，生图接口显式更长（见 generation.ts）
 * 4. 错误归一化：统一抛 ApiError { statusCode, message }，401 触发全局登出
 * 5. 响应体扁平：成功返回 payload，失败抛 ApiError（payload.error 或兜底文案）
 *
 * 401 拦截：遇 401 调注入的 onUnauthorized 回调（由 AuthContext 注入 logout + 跳登录），
 * 避免循环依赖（client 不直接 import context）。
 */
import type { ApiError } from "../types/api";

type GetToken = () => string | null | undefined;
type OnUnauthorized = () => void;

let tokenGetter: GetToken | null = null;
let unauthorizedHandler: OnUnauthorized | null = null;

/** 注入 token 获取器（AuthContext 启动时调用） */
export function setTokenGetter(getter: GetToken) {
  tokenGetter = getter;
}

/** 注入 401 处理器（AuthContext 启动时调用，做 logout + 跳登录） */
export function setUnauthorizedHandler(handler: OnUnauthorized) {
  unauthorizedHandler = handler;
}

export type RequestOptions = RequestInit & {
  /** 超时毫秒，默认 30000 */
  timeoutMs?: number;
  /** 外部 AbortSignal（如组件卸载取消生图） */
  signal?: AbortSignal;
  /** 显式覆盖 token（少数场景，默认走 tokenGetter） */
  token?: string;
};

/** 默认超时 30s */
const DEFAULT_TIMEOUT = 30_000;

/**
 * 统一请求：注入 token、超时、AbortController、错误归一化。
 * 401 触发注入的 onUnauthorized（统一登出），仍抛 ApiError 供调用方兜底。
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal: externalSignal, token, ...init } = options;

  const headers = new Headers(init.headers);
  const resolvedToken = token ?? tokenGetter?.();
  if (resolvedToken) headers.set("Authorization", `Bearer ${resolvedToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // 超时与外部 signal 合并：任一触发即 abort
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw Object.assign(new Error("请求已取消。"), { statusCode: undefined });
    }
    throw Object.assign(new Error("网络请求失败，请检查连接。"), { statusCode: undefined });
  }
  clearTimeout(timer);

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = Object.assign(new Error((payload as { error?: string }).error || "请求失败。"), {
      statusCode: response.status
    }) as ApiError;
    // 401 统一登出：交由注入的处理器，避免 4+ 处重复
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw apiError;
  }
  return payload as T;
}
