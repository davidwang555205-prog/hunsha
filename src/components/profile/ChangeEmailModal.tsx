/**
 * ChangeEmailModal -- 变更邮箱弹窗
 *
 * 从 ChangeEmailPage 抽出，逻辑完全一致：
 *   输入新邮箱 → PUT /api/v1/users/email/bind-request 发验证邮件。
 *   验证通过邮件内链接完成（GET /api/v1/users/email/verify 回跳应用），
 *   故本弹窗仅负责发起请求并给出"前往邮箱验证"的引导，无验证码输入。
 *
 * 与独立页的差异：sent 状态下显示"返回"按钮关弹窗，而非 navigate。
 */
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { sendBindEmailVerification } from "../../api/auth";
import type { ApiError } from "../../types/api";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Field } from "../ui/Field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChangeEmailModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // 重置表单（关闭时调用，让下次打开是干净状态）
  const resetForm = () => {
    setEmail("");
    setError("");
    setInfo("");
    setSent(false);
  };

  // 统一关闭入口：loading 中禁止关闭，关闭前重置表单
  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    setInfo("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("请输入有效的邮箱地址。");
      return;
    }
    if (user?.email && email.trim().toLowerCase() === user.email.toLowerCase()) {
      setError("新邮箱不能与当前邮箱相同。");
      return;
    }
    setLoading(true);
    try {
      await sendBindEmailVerification({ email: email.trim() });
      setSent(true);
      setInfo(`验证邮件已发送至 ${email.trim()}，请前往邮箱点击链接完成变更。`);
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "请求失败。"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="变更邮箱"
      size="sm"
      footer={
        sent ? (
          <Button variant="primary" size="sm" onClick={handleClose}>
            完成
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={loading}>
              发送验证邮件
            </Button>
          </>
        )
      }
    >
      <p className="mb-4 text-sm text-text-muted">当前邮箱：{user?.email || "未绑定"}</p>

      {!sent ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <Field label="新邮箱" hint="验证邮件将发送至该邮箱">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="example@domain.com"
              autoComplete="email"
            />
          </Field>

          {error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      ) : (
        <div className="space-y-3">
          <p className="rounded-md bg-primary/5 px-3 py-3 text-sm text-primary ring-1 ring-primary/20" role="status">
            {info}
          </p>
          <p className="text-center text-xs text-text-subtle">
            没收到邮件？请检查垃圾箱，或关闭后稍后重试。
          </p>
        </div>
      )}
    </Modal>
  );
}
