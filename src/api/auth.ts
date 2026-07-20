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
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetBySmsRequest,
  ResetPasswordEmailRequest,
  ResetPasswordTokenRequest,
  SendSmsCodeRequest,
  StatusResponse
} from "../types/api";

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

/** POST /api/v1/users/sms/send（注册/重置密码发送短信验证码，scene 区分） */
export function sendSmsCode(req: SendSmsCodeRequest) {
  return apiRequest<unknown>("/api/v1/users/sms/send", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** POST /api/v1/users/register（手机号注册，成功自动登录返回 user） */
export function register(req: RegisterRequest) {
  return apiRequest<LoginResponse>("/api/v1/users/register", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** PUT /api/v1/users/passwords/reset-by-sms（短信验证码重置密码） */
export function resetPasswordBySms(req: ResetBySmsRequest) {
  return apiRequest<unknown>("/api/v1/users/passwords/reset-by-sms", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** PUT /api/v1/users/passwords/change（已登录改密，初始密码强制改密也走此接口） */
export function changePassword(req: ChangePasswordRequest) {
  return apiRequest<unknown>("/api/v1/users/passwords/change", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** PUT /api/v1/users/passwords/reset-request（邮件重置：发送重置邮件，email 用户用） */
export function sendResetPasswordEmail(req: ResetPasswordEmailRequest) {
  return apiRequest<unknown>("/api/v1/users/passwords/reset-request", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** GET /api/v1/users/passwords/accounts/:token（邮件重置：查重置账户信息） */
export function getAccountInfo(token: string) {
  return apiRequest<StatusResponse>(`/api/v1/users/passwords/accounts/${encodeURIComponent(token)}`);
}

/** PUT /api/v1/users/passwords/reset（邮件重置：token + 新密码提交） */
export function resetPassword(req: ResetPasswordTokenRequest) {
  return apiRequest<unknown>("/api/v1/users/passwords/reset", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}
