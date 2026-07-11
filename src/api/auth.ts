/**
 * 认证与账号管理 API
 *
 * 对应后端 bridalauth handler：
 *   POST   /api/login            登录
 *   GET    /api/me               当前用户 + 账号列表 + 概要
 *   POST   /api/admin/users      开通账号（admin）
 *   PATCH  /api/admin/users/:id  改限额 / 改密码（admin）
 */
import { apiRequest } from "./client";
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRequest,
  UpdateUserResponse
} from "../types/api";

/** POST /api/login */
export function login(req: LoginRequest) {
  return apiRequest<LoginResponse>("/api/login", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** GET /api/me */
export function getMe() {
  return apiRequest<MeResponse>("/api/me");
}

/** POST /api/admin/users（admin 开通账号） */
export function createUser(req: CreateUserRequest) {
  return apiRequest<CreateUserResponse>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** PATCH /api/admin/users/:id（改限额或改密码） */
export function updateUser(userId: string, req: UpdateUserRequest) {
  return apiRequest<UpdateUserResponse>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}
