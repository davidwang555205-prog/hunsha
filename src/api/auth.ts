/**
 * 认证 API（team cookie session）
 *
 * 对应后端 team handler（biz/team/handler/http/v1/user.go）：
 *   POST /api/v1/teams/users/login    登录（email+password，后端 Set-Cookie 建立双 session）
 *   GET  /api/v1/teams/users/status    当前登录态 + user（TeamUser）
 *   POST /api/v1/teams/users/logout    登出（清 cookie）
 * 响应均由 client 解包 web.Resp.data。
 *
 * 验证码注册/重置（SMS + Email 双通道，SMS 不可用时降级到 Email）：
 *   POST /api/v1/users/verification/send       发 6 位数字验证码
 *   POST /api/v1/users/register-by-code         通用注册（phone 或 email + code + channel）
 *   PUT  /api/v1/users/passwords/reset-by-code  通用重置（phone 或 email + code + channel + 新密码）
 */
import { apiRequest } from "./client";
import type {
  ChangePasswordRequest,
  ChangePhoneRequest,
  LoginRequest,
  LoginResponse,
  RegisterByCodeRequest,
  ResetByCodeRequest,
  SendVerificationCodeRequest,
  StatusResponse,
  VerificationDelivery
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

// ===== 通用验证码（SMS + Email 双通道）=====

/** POST /api/v1/users/verification/send（phone 或 email 之一，按可用性选通道） */
export function sendVerificationCode(req: SendVerificationCodeRequest) {
  return apiRequest<VerificationDelivery>("/api/v1/users/verification/send", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** POST /api/v1/users/register-by-code（通用注册，phone 或 email + code + channel） */
export function registerByCode(req: RegisterByCodeRequest) {
  return apiRequest<LoginResponse>("/api/v1/users/register-by-code", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** PUT /api/v1/users/passwords/reset-by-code（通用重置，phone 或 email + code + channel + 新密码） */
export function resetPasswordByCode(req: ResetByCodeRequest) {
  return apiRequest<unknown>("/api/v1/users/passwords/reset-by-code", {
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

/** PUT /api/v1/users/phone（登录态变更手机号，验证码校验新号） */
export function changePhone(req: ChangePhoneRequest) {
  return apiRequest<unknown>("/api/v1/users/phone", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** PUT /api/v1/users/email/bind-request（登录态请求绑定/变更邮箱，发验证邮件） */
export function sendBindEmailVerification(req: { email: string }) {
  return apiRequest<unknown>("/api/v1/users/email/bind-request", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}
