/**
 * RegisterPage -- 手机号注册（短信验证码）
 *
 * 手机号 + 密码 + 确认密码 + 短信验证码（60s 倒计时发送）。
 * 注册成功后端建双 session 自动登录，前端 setUser 后跳首页。
 * 短信服务未配置时后端返回 ErrRegisterDisabled，前端展示后端 message。
 */
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { register, sendSmsCode } from "../api/auth";
import type { ApiError } from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import logo from "../assets/logo.png";

const PHONE_RE = /^\d{11}$/;

export function RegisterPage() {
  const { isAuthenticated, refreshUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const clearError = () => error && setError("");

  const handleSendCode = async () => {
    setError("");
    if (!PHONE_RE.test(phone)) {
      setError("请输入 11 位手机号。");
      return;
    }
    setSending(true);
    try {
      await sendSmsCode({ phone, scene: "register" });
      setCountdown(60);
    } catch (err) {
      setError((err as ApiError | undefined)?.message || "验证码发送失败。");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!PHONE_RE.test(phone)) {
      setError("请输入 11 位手机号。");
      return;
    }
    if (password.length < 8 || password.length > 32) {
      setError("密码长度需为 8-32 个字符。");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (!smsCode.trim()) {
      setError("请输入短信验证码。");
      return;
    }
    setLoading(true);
    try {
      const u = await register({ phone, password, sms_code: smsCode });
      refreshUser(u);
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "注册失败。"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 text-text">
      <div className="flex flex-1 items-center justify-center">
        <GlassCard className="w-full max-w-md p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient p-1 shadow-md">
              <img src={logo} alt="Bridal & Dress" className="h-full w-full rounded-md object-cover" />
            </div>
            <GradientText duration={6} className="font-display text-sm uppercase tracking-[0.24em]">
              Bridal &amp; Dress
            </GradientText>
            <BlurText as="h1" text="账号注册" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">手机号验证码注册</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="手机号">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError();
                }}
                autoComplete="tel"
                placeholder="11 位手机号"
                maxLength={11}
              />
            </Field>
            <Field label="密码" hint="8-32 个字符">
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field label="确认密码">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  clearError();
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field label="短信验证码">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={smsCode}
                  onChange={(e) => {
                    setSmsCode(e.target.value);
                    clearError();
                  }}
                  placeholder="6 位验证码"
                  maxLength={6}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={sending || countdown > 0}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? <Spinner size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
                </button>
              </div>
            </Field>

            {error && (
              <motion.p
                initial={{ x: -6 }}
                animate={{ x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.32 }}
                className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20"
                role="alert"
              >
                {error}
              </motion.p>
            )}

            <MagneticButton
              type="submit"
              loading={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition duration-fast ease-out hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Spinner size={16} />}
              {loading ? "注册中..." : "注册"}
            </MagneticButton>

            <div className="text-center text-sm text-text-muted">
              已有账号？
              <Link to="/login" className="ml-1 font-medium text-primary transition hover:text-primary-600">
                去登录
              </Link>
            </div>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
