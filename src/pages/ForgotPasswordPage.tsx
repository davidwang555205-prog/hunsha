/**
 * ForgotPasswordPage -- 忘记密码（单 input 通用验证码重置）
 *
 * 输入邮箱或手机号，按 mode 走 6 位数字验证码通道：
 * - email 模式：邮件验证码（替代旧的 24h 邮件链接）
 * - phone 模式：短信验证码
 *
 * SMS 不可用时（10648 ErrSmsUnavailableForPhone）：提示用户改用邮箱重置
 *   （不允许任意补 email，避免重置错误账号——绑定 email 走 user 表由后端控制）。
 *
 * 双不可用（10647）：系统级通道不可用，提示联系管理员。
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { resetPasswordByCode, sendVerificationCode } from "../api/auth";
import {
  ApiError,
  VerificationChannel,
  VerificationErrorCode,
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
import { identifyAccount } from "../lib/accountIdentifier";
import logo from "../assets/logo.png";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  const clearMsg = () => {
    if (error) setError("");
    if (info) setInfo("");
  };

  const resetDeliveryState = () => {
    setChannel(null);
    setMaskedDestination("");
    setCode("");
    setCountdown(0);
  };

  const handleAccountChange = (v: string) => {
    setAccount(v);
    resetDeliveryState();
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1);
    clearMsg();
  };

  const handleCaptchaToken = (token: string) => {
    setCaptchaToken(token);
    setInfo("人机验证通过。");
    clearMsg();
  };

  const handleCaptchaError = (_code: string, message: string) => {
    setCaptchaToken(null);
    setError(message || "人机验证失败，请重试。");
    setCaptchaResetSignal((s) => s + 1);
  };

  const handleSendCode = async () => {
    clearMsg();
    const kind = identifyAccount(account);
    if (kind === "invalid") {
      setError("请输入 11 位手机号或邮箱地址。");
      return;
    }
    if (!captchaToken) {
      setError("请先完成人机验证。");
      return;
    }
    setSending(true);
    try {
      const phone = kind === "phone" ? account : undefined;
      const email = kind === "email" ? account : undefined;
      const d = await sendVerificationCode({
        phone,
        email,
        scene: "reset_password",
        captcha_token: captchaToken
      });
      setChannel(d.channel);
      setMaskedDestination(d.masked_destination);
      setCountdown(d.retry_after_seconds || 60);
      setInfo(
        d.channel === "sms"
          ? `短信验证码已发送至 ${d.masked_destination}`
          : `验证码已发送至 ${d.masked_destination}`
      );
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
      const codeVal = errorCodeOf(err);
      if (codeVal === VerificationErrorCode.SmsUnavailableForPhone) {
        setError("短信通道暂不可用，如该账号绑定邮箱，请改用邮箱重置。");
      } else if (codeVal === VerificationErrorCode.VerificationChannelUnavailable) {
        setError("当前验证码通道不可用，请联系管理员。");
      } else if (
        codeVal === VerificationErrorCode.PhoneNotFound ||
        codeVal === VerificationErrorCode.EmailNotBound
      ) {
        setError((err as ApiError).message || "该账号未注册。");
      } else {
        setError((err as ApiError | undefined)?.message || "验证码发送失败。");
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    clearMsg();
    const kind = identifyAccount(account);
    if (kind === "invalid") {
      setError("请输入 11 位手机号或邮箱地址。");
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
    if (newPassword.length < 8 || newPassword.length > 32) {
      setError("新密码长度需为 8-32 个字符。");
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setLoading(true);
    try {
      const phone = kind === "phone" ? account : undefined;
      const email = kind === "email" ? account : undefined;
      await resetPasswordByCode({
        phone,
        email,
        code,
        channel,
        new_password: newPassword
      });
      navigate("/login", { replace: true });
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "重置密码失败。"
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
            <BlurText as="h1" text="重置密码" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">邮箱或手机号 + 6 位数字验证码重置</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="邮箱或手机号">
              <Input
                type="text"
                value={account}
                onChange={(e) => handleAccountChange(e.target.value)}
                autoComplete="username"
                placeholder="邮箱或 11 位手机号"
                maxLength={64}
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
                    clearMsg();
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

            <Field label="新密码" hint="8-32 个字符">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearMsg();
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field label="确认新密码">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  clearMsg();
                }}
                autoComplete="new-password"
              />
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
              {loading ? "重置中..." : "重置密码"}
            </MagneticButton>

            <div className="text-center text-sm text-text-muted">
              想起密码了？
              <Link to="/login" className="ml-1 font-medium text-primary transition hover:text-primary-600">
                返回登录
              </Link>
            </div>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
