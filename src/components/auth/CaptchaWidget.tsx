/**
 * CaptchaWidget -- Cap.js 行为验证码（Proof of Work）
 *
 * Cap.js 是自托管 PoW 验证码（https://trycap.dev），与后端 go-cap SDK 协议完全兼容。
 *
 * 流程（widget 自动完成）：
 * 1. widget 自动调 POST /api/v1/public/captcha/challenge
 * 2. 用户点击验证 → widget 在浏览器做 PoW 计算（用 WebAssembly + Worker）
 * 3. widget 自动调 POST /api/v1/public/captcha/redeem 拿 captcha_token
 * 4. 'solve' 事件携带 token → 父组件 setCaptchaToken
 *
 * dev/prod 行为：
 * - dev（u.config.Debug=true）：后端跳过 captcha 校验，widget 仍算 PoW（多花几十 ms 但流程一致）
 * - prod（Debug=false）：后端强校验 captcha_token
 *
 * 重置：父组件传 key={resetSignal} prop，React 在 key 变化时自动卸载+重挂载。
 */
import { useEffect, useRef } from "react";
import "@cap.js/widget";
import type { CapSolveEvent, CapWidget } from "@cap.js/widget";

type Props = {
  /** 父组件拿到的回调：Cap.js widget solve 后携 token */
  onToken: (token: string) => void;
  /** 父组件拿到的回调：widget error 时携 code + message */
  onError?: (code: string, message: string) => void;
};

export function CaptchaWidget({ onToken, onError }: Props) {
  const ref = useRef<CapWidget>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleSolve = (e: Event) => {
      const detail = (e as CapSolveEvent).detail;
      onToken(detail.token);
    };
    const handleError = (e: Event) => {
      const ce = e as CustomEvent<{ isCap: boolean; code: string; message: string }>;
      onError?.(ce.detail.code, ce.detail.message);
    };
    el.addEventListener("solve", handleSolve);
    el.addEventListener("error", handleError);
    return () => {
      el.removeEventListener("solve", handleSolve);
      el.removeEventListener("error", handleError);
    };
  }, [onToken, onError]);

  return (
    // cap-widget 是 Web Component（HTMLElementTagNameMap 已注册 CapWidget 类型）
    // 末尾 / 必加，Cap.js 拼接 challenge/redeem 路径
    <cap-widget ref={ref} data-cap-api-endpoint="/api/v1/public/captcha/" />
  );
}
