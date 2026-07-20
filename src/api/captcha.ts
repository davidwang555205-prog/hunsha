/**
 * 图形验证码 API（go-cap SDK 后端）
 *
 * 流程：
 * 1. 调 getChallenge() → 拿 ChallengeData{challenge:{c,s,d}, expires, token}
 * 2. 用户在 UI 完成 C 个质询（每个答案 int64，存进 solutions 数组）
 * 3. 调 redeemCaptcha({token, solutions}) → 拿 captcha_token
 * 4. 业务接口（sendVerificationCode 等）body 携带 captcha_token
 *
 * dev 环境：u.config.Debug=true 跳过 captcha 校验，可不调本接口直接发码
 * prod 环境：必须走完 challenge→redeem 全流程，否则 ErrForbidden
 */
import { apiRequest } from "./client";

/** 单个质询配置（go-cap ChallengeItem） */
export type ChallengeItem = {
  c: number; // 质询数量
  s: number; // 质询大小
  d: number; // 质询难度
};

/** 质询响应（go-cap ChallengeData） */
export type ChallengeResponse = {
  challenge: ChallengeItem;
  expires: number; // 过期时间，毫秒级时间戳
  token: string; // 质询令牌
};

/** redeem 响应（go-cap VerificationResult） */
export type VerificationResult = {
  success: boolean;
  message?: string;
  token_data?: {
    token: string; // 业务接口要用的 captcha_token
    expires: number; // 过期时间，毫秒级
  };
};

/** redeem 请求体 */
export type RedeemCaptchaRequest = {
  token: string;
  solutions: number[];
};

/** POST /api/v1/public/captcha/challenge */
export function getChallenge() {
  return apiRequest<ChallengeResponse>("/api/v1/public/captcha/challenge", {
    method: "POST"
  });
}

/** POST /api/v1/public/captcha/redeem */
export function redeemCaptcha(req: RedeemCaptchaRequest) {
  return apiRequest<VerificationResult>("/api/v1/public/captcha/redeem", {
    method: "POST",
    body: JSON.stringify(req)
  });
}
