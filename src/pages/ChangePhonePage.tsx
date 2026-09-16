/**
 * ChangePhonePage -- 变更手机号（登录态，验证码校验新号）
 *
 * 流程：输入新手机号 → 人机验证 → 发码（scene=change_phone）→ 填验证码 →
 * PUT /api/v1/users/phone 校验通过后更换绑定手机号。复用通用验证码双通道能力，
 * 但变更手机号固定以新手机号为目标；若短信通道不可用则提示无法变更。
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { changePhone, sendVerificationCode } from "../api/auth";
import { isPhone } from "../lib/accountIdentifier";
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
import { ArrowLeftIcon } from "../components/icons";
import logo from "../assets/logo.png";

export function ChangePhonePage() {
  const { user, refreshStatus } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [channel, setChannel] = useState<VerificationChannel | null>(null);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [code, setCode] = useState("");
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

  const clearFeedback = () => {
    if (error) setError("");
    if (info) setInfo("");
  };

  const handlePhoneChange = (v: string) => {
    setPhone(v);
    setChannel(null);
    setMaskedDestination("");
    setCode("");
    setCountdown(0);
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1);
    clearFeedback();
  };

  const handleCaptchaToken = (token: string) => {
    setCaptchaToken(token);
    clearFeedback();
  };

  const handleCaptchaError = (_code: string, message: string) => {
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1);
    setError(message || "人机验证失败，请重试。");
  };

  const handleSendCode = async () => {
    if (sending) return;
    clearFeedback();
    if (!isPhone(phone)) {
      setError("请输入 11 位手机号。");
      return;
    }
    if (user?.phone && phone.trim() === user.phone) {
      setError("新手机号不能与当前手机号相同。");
      return;
    }
    if (!captchaToken) {
      setError("请先完成人机验证。");
      return;
    }
    setSending(true);
    try {
      const d = await sendVerificationCode({
        phone: phone.trim(),
        scene: "change_phone",
        captcha_token: captchaToken
      });
      setChannel(d.channel);
      setMaskedDestination(d.masked_destination);
      setCountdown(d.retry_after_seconds || 60);
      setInfo(`验证码已发送至 ${d.masked_destination}`);
      // Cap token 一次性：后端发码成功即消费，重发前必须重新过验证
      setCaptchaToken(null);
      setCaptchaResetSignal((s) => s + 1);
    } catch (err) {
      // 后端 Cap token 一次性：无论成功或何种业务失败，后端均已消费 token，必须清空并重置
      setCaptchaToken(null);
      setCaptchaResetSignal((s) => s + 1);

      // 403=后端 Cap token 校验失败（token 已消费或过期）
      if ((err as ApiError | undefined)?.statusCode === 403) {
        setError("人机验证已失效，请重新完成验证后再试。");
        return;
      }
      const code = errorCodeOf(err);
      if (code === VerificationErrorCode.SmsUnavailableForPhone) {
        setError("短信通道暂不可用，当前无法变更手机号，请稍后再试。");
      } else if (code === VerificationErrorCode.VerificationChannelUnavailable) {
        setError("验证码通道不可用，请联系管理员。");
      } else if (code === VerificationErrorCode.PhoneTaken) {
        setError("该手机号已被其他账号使用。");
      } else {
        setError((err as ApiError | undefined)?.message || "验证码发送失败。");
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    clearFeedback();
    if (!isPhone(phone)) {
      setError("请输入 11 位手机号。");
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
      await changePhone({ phone: phone.trim(), code: code.trim(), channel });
      await refreshStatus();
      navigate("/profile", { replace: true, state: { phoneChanged: true } });
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "变更失败。"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 text-text">
      <div className="flex flex-1 items-center justify-center">
        <GlassCard className="w-full max-w-md p-8">
          <div className="mb-6 flex items-center gap-2">
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg hover:text-text"
              aria-label="返回个人中心"
            >
              <ArrowLeftIcon />
            </Link>
            <span className="text-sm text-text-muted">返回个人中心</span>
          </div>

          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient p-1 shadow-md">
              <img src={logo} alt="Bridal & Dress" className="h-full w-full rounded-md object-cover" />
            </div>
            <GradientText duration={6} className="font-display text-sm uppercase tracking-[0.24em]">
              Bridal &amp; Dress
            </GradientText>
            <BlurText as="h1" text="变更手机号" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">当前手机号：{user?.phone || "未绑定"}</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="新手机号">
              <Input
                type="text"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="11 位手机号"
                maxLength={11}
              />
            </Field>

            <Field label="人机验证" hint={captchaToken ? "✓ 已通过" : "请完成验证后再获取验证码"}>
              <CaptchaWidget
                key={captchaResetSignal}
                onToken={handleCaptchaToken}
                onError={handleCaptchaError}
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
              {loading ? "提交中..." : "确认变更"}
            </MagneticButton>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
