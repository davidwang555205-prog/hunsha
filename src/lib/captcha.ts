/**
 * captcha helper -- 串联 challenge + redeem 流程，吐出 captcha_token
 */
import { getChallenge, redeemCaptcha } from "../api/captcha";

/** 拿到 captcha_token（业务接口用）。失败时抛 ApiError。 */
export async function fetchCaptchaToken(solutions: number[]): Promise<string> {
  const challenge = await getChallenge();
  if (!challenge?.token) {
    throw new Error("获取验证码质询失败。");
  }
  const result = await redeemCaptcha({
    token: challenge.token,
    solutions
  });
  if (!result.success || !result.token_data?.token) {
    throw new Error(result.message || "人机验证未通过。");
  }
  return result.token_data.token;
}
