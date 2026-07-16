/**
 * 认证 API（team cookie session）
 *
 * 对应后端 team handler（biz/team/handler/http/v1/user.go）：
 *   POST /api/v1/teams/users/login    登录（email+password，后端 Set-Cookie 建立双 session）
 *   GET  /api/v1/teams/users/status    当前登录态 + user（TeamUser）
 *   POST /api/v1/teams/users/logout    登出（清 cookie）
 * 响应均由 client 解包 web.Resp.data。
 */
import { apiRequest } from "./client";
import type { LoginRequest, LoginResponse, StatusResponse } from "../types/api";

/** POST /api/v1/teams/users/login */
export function login(req: LoginRequest) {
  return apiRequest<LoginResponse>("/api/v1/teams/users/login", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** GET /api/v1/teams/users/status（探测登录态，未登录 401 静默，不触发自动登出） */
export function getStatus() {
  return apiRequest<StatusResponse>("/api/v1/teams/users/status", { skipUnauthorized: true });
}

/** POST /api/v1/teams/users/logout（自身 401 跳过拦截，避免 logout 401 再调 logout 死循环） */
export function logout() {
  return apiRequest<unknown>("/api/v1/teams/users/logout", {
    method: "POST",
    skipUnauthorized: true
  });
}
