/**
 * ChangeEmailPage -- 变更邮箱（登录态）
 *
 * 输入新邮箱 → PUT /api/v1/users/email/bind-request 发验证邮件。
 * 验证通过邮件内链接完成（GET /api/v1/users/email/verify 回跳应用），
 * 故本页仅负责发起请求并给出“前往邮箱验证”的引导，无验证码输入。
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { sendBindEmailVerification } from "../api/auth";
import type { ApiError } from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { ArrowLeftIcon } from "../components/icons";
import logo from "../assets/logo.png";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

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
            <BlurText as="h1" text="变更邮箱" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">当前邮箱：{user?.email || "未绑定"}</p>
          </div>

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
                {loading ? "发送中..." : "发送验证邮件"}
              </MagneticButton>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="rounded-md bg-primary/5 px-3 py-3 text-sm text-primary ring-1 ring-primary/20" role="status">
                {info}
              </p>
              <p className="text-center text-xs text-text-subtle">
                没收到邮件？请检查垃圾箱，或返回个人中心稍后重试。
              </p>
              <Link
                to="/profile"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-primary-600"
              >
                返回个人中心
              </Link>
            </div>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
