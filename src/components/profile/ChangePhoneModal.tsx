/**
 * ChangePhoneModal -- 变更手机号弹窗
 *
 * 从 ChangePhonePage 抽出，逻辑完全一致：
 *   输入新手机号 → 人机验证（Cap.js）→ 发码（scene=change_phone）→ 填验证码 →
 *   PUT /api/v1/users/phone 校验通过后更换绑定。
 * 短信通道不可用时提示无法变更（与原页一致）。
 *
 * 与独立页的差异：成功后不 navigate，而是调 onSuccess 让父组件刷新 user + 关弹窗。
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { changePhone, sendVerificationCode } from "../../api/auth";
import { isPhone } from "../../lib/accountIdentifier";
import {
  ApiError,
  VerificationChannel,
  VerificationErrorCode,
  errorCodeOf
} from "../../types/api";
import { CaptchaWidget } from "../auth/CaptchaWidget";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Field } from "../ui/Field";
import { Spinner } from "../ui/Spinner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ChangePhoneModal({ open, onClose, onSuccess }: Props) {
  const { user, refreshStatus } = useAuth();

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

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 重置表单（关闭时调用，让下次打开是干净状态）
  const resetForm = () => {
    setPhone("");
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1);
    setChannel(null);
    setMaskedDestination("");
    setCode("");
    setError("");
    setInfo("");
    setCountdown(0);
  };

  // 统一关闭入口：loading/sending 中禁止关闭，关闭前重置表单
  const handleClose = () => {
    if (loading || sending) return;
    resetForm();
    onClose();
  };

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
      // 403=后端 Cap token 校验失败（token 已消费或过期），重置验证码引导重新验证
      if ((err as ApiError | undefined)?.statusCode === 403) {
        setCaptchaToken(null);
        setCaptchaResetSignal((s) => s + 1);
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
      onSuccess?.();
      handleClose();
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
    <Modal
      open={open}
      onClose={handleClose}
      title="变更手机号"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading || sending}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={loading}>
            确认变更
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <p className="text-sm text-text-muted">当前手机号：{user?.phone || "未绑定"}</p>

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
          <CaptchaWidget key={captchaResetSignal} onToken={handleCaptchaToken} onError={handleCaptchaError} />
        </Field>

        <Field label="验证码" hint={maskedDestination ? `已发送至 ${maskedDestination}` : "6 位数字验证码"}>
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
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
