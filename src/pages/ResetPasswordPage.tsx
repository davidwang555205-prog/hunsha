/**
 * ResetPasswordPage -- 邮件 token 重置密码（邮件链接跳转页）
 *
 * URL /resetpassword?token=xxx（后端 sendEmail 生成此链接）。
 * 输新密码 + 确认 -> reset -> 跳 /login 重新登录。
 * token 无效或过期（24h）后端返回错误，前端提示重新申请。
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { resetPassword } from "../api/auth";
import type { ApiError } from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import logo from "../assets/logo.png";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!token) {
      setError("重置链接无效，请重新申请。");
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
      await resetPassword({ token, new_password: newPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "重置失败，链接可能已失效，请重新申请。"
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
            <BlurText as="h1" text="设置新密码" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">通过邮件链接重置密码</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="新密码" hint="8-32 个字符">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="new-password"
                autoFocus
              />
            </Field>
            <Field label="确认新密码">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="new-password"
              />
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
              {loading ? "重置中..." : "重置密码"}
            </MagneticButton>

            <div className="text-center text-sm text-text-muted">
              <Link to="/login" className="font-medium text-primary transition hover:text-primary-600">
                返回登录
              </Link>
            </div>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
