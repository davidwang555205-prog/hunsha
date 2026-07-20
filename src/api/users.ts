/**
 * 当前用户 API（team cookie session）
 *
 * 对应后端 user handler（biz/user/handler/v1/auth.go）：
 *   PUT /api/v1/users              修改昵称 / 头像（multipart/form-data）
 *   POST /api/v1/uploader          上传头像文件（usage=avatar），返回可访问 URL
 */
import { apiRequest } from "./client";
import type { UpdateCurrentUserRequest, UpdateUserResponse } from "../types/api";

/** PUT /api/v1/users（当前用户修改昵称 / 头像，multipart/form-data） */
export function updateCurrentUser(req: UpdateCurrentUserRequest) {
  const form = new FormData();
  if (req.name !== undefined) form.append("name", req.name);
  if (req.avatar_url !== undefined) form.append("avatar_url", req.avatar_url);
  return apiRequest<UpdateUserResponse>("/api/v1/users", {
    method: "PUT",
    body: form
  });
}

/** POST /api/v1/uploader（usage=avatar，返回可访问的头像 URL 字符串） */
export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("usage", "avatar");
  form.append("file", file);
  return apiRequest<string>("/api/v1/uploader", {
    method: "POST",
    body: form
  });
}
