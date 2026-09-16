/**
 * RegisterPage -- 单 input 通用注册（手机号或邮箱 + 6 位数字验证码）
 *
 * 流程：
 * 1. 用户输入手机号或邮箱，mode 智能判断（11 位数字 = phone，含 @ = email）
 * 2. 点"获取验证码" → 调 sendVerificationCode
 *    - 成功：保存 channel + masked_destination，倒计时开始
 *    - 失败 10648 ErrSmsUnavailableForPhone：显示 fallback email 输入框（SMS 不可用，phone 用户补 email）
 *    - 失败 10647 ErrVerificationChannelUnavailable：双不可用，明确错误
 * 3. 用户补填 email 后再次点"获取验证码"（带 fallbackEmail 入参）
 * 4. 填验证码 + 密码 + 确认密码 → 调 registerByCode（带回 channel 与所有 target）
 * 5. 成功自动登录（后端写双 session），前端 setUser 跳首页
 *
 * account 改动立即清空 channel/code/countdown/所有提示，防止 A 账号验证码提交到 B 账号。
 */
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { registerByCode, sendVerificationCode } from "../api/auth";
import {
  ApiError,
  VerificationErrorCode,
  VerificationChannel,
  errorCodeOf
} from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { CaptchaWidget } from "../components/auth/CaptchaWidget";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { identifyAccount, isPhone } from "../lib/accountIdentifier";
import logo from "../assets/logo.png";

export function RegisterPage() {
  const { isAuthenticated, refreshUser } = useAuth();
  const [account, setAccount] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState(""); // phone SMS 不可用时展示
  const [showFallbackEmail, setShowFallbackEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<VerificationChannel | null>(null);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
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

  const clearFeedback = () => {
    if (error) setError("");
    if (info) setInfo("");
  };

  const resetDeliveryState = () => {
    setChannel(null);
    setMaskedDestination("");
    setCode("");
    setCountdown(0);
    setShowFallbackEmail(false);
    setFallbackEmail("");
  };

  const handleAccountChange = (v: string) => {
    setAccount(v);
    // account 改变：清空所有 delivery state 防止 A 账号验证码提交到 B 账号
    resetDeliveryState();
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1); // 触发 CaptchaWidget 重置
    clearFeedback();
  };

  const handleCaptchaToken = (token: string) => {
    setCaptchaToken(token);
    setInfo("人机验证通过。");
    clearFeedback();
  };

  const handleCaptchaError = (_code: string, message: string) => {
    setCaptchaToken(null);
    setError(message || "人机验证失败，请重试。");
    setCaptchaResetSignal((s) => s + 1);
  };

  const handleSendCode = async () => {
    clearFeedback();
    const kind = identifyAccount(account);
    if (kind === "invalid") {
      setError("请输入 11 位手机号或邮箱地址。");
      return;
    }
    if (kind === "phone" && !showFallbackEmail) {
      // 第一次发码用 phone 试 SMS；若后端返 10648，再让用户补 email
    }
    if (showFallbackEmail) {
      // 第二次发码必须先填 fallback email
      const fk = identifyAccount(fallbackEmail);
      if (fk !== "email") {
        setError("请补充有效的邮箱地址。");
        return;
      }
    }
    if (!captchaToken) {
      setError("请先完成人机验证。");
      return;
    }
    setSending(true);
    try {
      const phone = kind === "phone" ? account : undefined;
      const email = kind === "email" ? account : showFallbackEmail ? fallbackEmail : undefined;
      const d = await sendVerificationCode({
        phone,
        email,
        scene: "register",
        captcha_token: captchaToken
      });
      setChannel(d.channel);
      setMaskedDestination(d.masked_destination);
      setCountdown(d.retry_after_seconds || 60);
      setInfo(channelSuccessMessage(d.channel, d.masked_destination));
      // Cap token 一次性：后端发码成功即消费，重发前必须重新过验证
      setCaptchaToken(null);
      setCaptchaResetSignal((s) => s + 1);
    } catch (err) {
      // 403=后端 Cap token 校验失败（token 已消费或过期），重置验证码引导重新验证
      if ((err as ApiError | undefined)?.statusCode === 403) {
        setCaptchaToken(null);
        setCaptchaResetSignal((s) => s + 1);
        setError("人机验证已失效，请重新完成验证后再试。");
        return;
      }
      const code = errorCodeOf(err);
      if (code === VerificationErrorCode.SmsUnavailableForPhone) {
        // 10648: phone SMS 不可用，让用户补 email
        setShowFallbackEmail(true);
        setError("短信通道暂不可用，请补充邮箱以接收验证码。");
      } else if (code === VerificationErrorCode.VerificationChannelUnavailable) {
        setError("当前验证码通道不可用，请联系管理员。");
      } else if (code === VerificationErrorCode.PhoneTaken || code === VerificationErrorCode.EmailTaken) {
        // 用 i18n 风格直接显示 message（后端 i18n key 已翻译）
        setError((err as ApiError).message || "该账号已注册。");
      } else {
        setError((err as ApiError | undefined)?.message || "验证码发送失败。");
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    clearFeedback();
    const kind = identifyAccount(account);
    if (kind === "invalid") {
      setError("请输入 11 位手机号或邮箱地址。");
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
    if (!code.trim()) {
      setError("请输入验证码。");
      return;
    }
    if (!channel) {
      setError("请先获取验证码。");
      return;
    }
    setLoading(true);
    try {
      const phone = kind === "phone" ? account : undefined;
      const email = kind === "email" ? account : showFallbackEmail ? fallbackEmail : undefined;
      const u = await registerByCode({
        phone,
        email,
        password,
        code,
        channel
      });
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
            <p className="mt-2 text-sm text-text-muted">手机号或邮箱 + 验证码注册</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="手机号或邮箱">
              <Input
                type="text"
                value={account}
                onChange={(e) => handleAccountChange(e.target.value)}
                autoComplete="username"
                placeholder="11 位手机号或邮箱"
                maxLength={64}
              />
            </Field>

            {showFallbackEmail && isPhone(account) && (
              <Field label="补充邮箱" hint="短信通道暂不可用，请用邮箱接收验证码">
                <Input
                  type="email"
                  value={fallbackEmail}
                  onChange={(e) => {
                    setFallbackEmail(e.target.value);
                    clearFeedback();
                  }}
                  autoComplete="email"
                  placeholder="example@domain.com"
                />
              </Field>
            )}

            <Field label="密码" hint="8-32 个字符">
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFeedback();
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
                  clearFeedback();
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field
              label="验证码"
              hint={maskedDestination ? `已发送至 ${maskedDestination}` : "6 位数字验证码"}
            >
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    clearFeedback();
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

            <Field label="人机验证" hint={captchaToken ? "✓ 已通过" : "请完成验证再获取验证码"}>
              <CaptchaWidget
                key={captchaResetSignal}
                onToken={handleCaptchaToken}
                onError={handleCaptchaError}
              />
            </Field>

            {info && !error && (
              <p className="rounded-md bg-primary/5 px-3 py-2 text-sm text-primary ring-1 ring-primary/20" role="status">
                {info}
              </p>
            )}

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

function channelSuccessMessage(channel: VerificationChannel, dest: string): string {
  return channel === "sms" ? `短信验证码已发送至 ${dest}` : `验证码已发送至 ${dest}`;
}
