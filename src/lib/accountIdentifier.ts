/**
 * accountIdentifier -- 账号标识识别
 *
 * 单 input 输入（手机号或邮箱）模式判断：
 * - 含 @ 视为 email
 * - 11 位纯数字视为 phone（与中国大陆 11 位 1 开头的判定保持一致，宽松版只判长度）
 * - 其他视为 invalid
 *
 * 与 ForgotPasswordPage 现有 mode 模式一致；抽出 helper 避免两处正则漂移。
 */

const PHONE_RE = /^\d{11}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountKind = "phone" | "email" | "invalid";

export function identifyAccount(input: string): AccountKind {
  const v = input.trim();
  if (!v) return "invalid";
  if (v.includes("@")) return EMAIL_RE.test(v) ? "email" : "invalid";
  return PHONE_RE.test(v) ? "phone" : "invalid";
}

export function isValidAccount(input: string): boolean {
  return identifyAccount(input) !== "invalid";
}

export function isPhone(input: string): boolean {
  return identifyAccount(input) === "phone";
}

export function isEmail(input: string): boolean {
  return identifyAccount(input) === "email";
}
