/**
 * API client -- fetch 统一封装
 *
 * 认证切 MonkeyCode team cookie session 后：
 * 1. credentials: "include" -- 携带 cookie（team login Set-Cookie 建立 session）
 * 2. 响应解包：team 路由用 web.Resp {code,message,data} 包装，8 模块用 c.JSON 扁平。
 *    统一规则：payload 含 code+data 字段则返回 data，否则返回 payload。
 * 3. 错误归一化：8 模块 { error }，team { code,message }，统一取 error||message。
 * 4. 401 拦截：遇 401 调注入的 onUnauthorized 回调（AuthContext 注入 logout + 跳登录）。
 * 5. AbortController + 超时（默认 30s，生图接口显式更长）。
 */
import type { ApiError } from "../types/api";

type OnUnauthorized = () => void;

let unauthorizedHandler: OnUnauthorized | null = null;

/** 注入 401 处理器（AuthContext 启动时调用，做 logout + 跳登录） */
export function setUnauthorizedHandler(handler: OnUnauthorized) {
  unauthorizedHandler = handler;
}

export type RequestOptions = RequestInit & {
  /** 超时毫秒，默认 30000 */
  timeoutMs?: number;
  /** 外部 AbortSignal（如组件卸载取消生图） */
  signal?: AbortSignal;
  /** 跳过 401 自动登出：用于 status 探测（未登录 401 是正常态）与 logout 自身
   *  （logout 接口 401 不应再触发拦截调 logout，否则死循环）。 */
  skipUnauthorized?: boolean;
};

/** 默认超时 30s */
const DEFAULT_TIMEOUT = 30_000;

/** 判断 payload 是否为 web.Resp 包装。失败响应可能省略 data。 */
function isWebResp(payload: unknown): payload is { code: number; message: string; data?: unknown } {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return typeof p.code === "number" && typeof p.message === "string";
}

/**
 * 统一请求：cookie 携带、超时、AbortController、响应解包、错误归一化。
 * 401 触发注入的 onUnauthorized（统一登出），仍抛 ApiError 供调用方兜底。
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal: externalSignal, skipUnauthorized = false, ...init } = options;

  const headers = new Headers(init.headers);
  // FormData 让浏览器自动设 multipart boundary（含 boundary 分隔符），不能手动设 application/json
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // 超时与外部 signal 合并：任一触发即 abort
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, signal: controller.signal, credentials: "include" });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw Object.assign(new Error("请求已取消。"), { statusCode: undefined });
    }
    throw Object.assign(new Error("网络请求失败，请检查连接。"), { statusCode: undefined });
  }
  clearTimeout(timer);

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // 错误归一化：8 模块 { error }，team { message }
    const message =
      (typeof payload.error === "string" && payload.error) ||
      (typeof payload.message === "string" && payload.message) ||
      "请求失败。";
    const apiError = Object.assign(new Error(message), {
      statusCode: response.status,
      code: typeof (payload as { code?: unknown }).code === "number" ? (payload as { code: number }).code : undefined
    }) as ApiError;
    // 401 统一登出：交由注入的处理器，避免 4+ 处重复。
    // skipUnauthorized 跳过（status 探测 / logout 自身），防止 logout 401 再触发拦截死循环。
    if (response.status === 401 && !skipUnauthorized) {
      unauthorizedHandler?.();
    }
    throw apiError;
  }
  // 响应解包：team web.Resp -> data，8 模块扁平 -> payload
  if (isWebResp(payload)) {
    // web.Resp 业务码非 0 即业务错误（如登录失败 code=10606），HTTP 仍是 200，
    // 必须主动校验 code 才能识别，否则前端静默返回 data=null，用户无任何反馈。
    if (payload.code !== 0) {
      throw Object.assign(new Error(payload.message || "请求失败。"), {
        statusCode: response.status,
        code: payload.code
      }) as ApiError;
    }
    return payload.data as T;
  }
  return payload as T;
}
