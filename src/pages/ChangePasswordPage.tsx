/**
 * ChangePasswordPage -- 修改密码（已登录）
 *
 * 当前密码 + 新密码 + 确认新密码。
 * ?force=1：初始密码强制改密模式（admin 建号首登），顶部黄色提示条，改完跳首页。
 * 改密成功后 refreshStatus 刷新 user（mustChangePassword 清零 -> 守卫放行）。
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../api/auth";
import type { ApiError } from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import logo from "../assets/logo.png";

export function ChangePasswordPage() {
  const { refreshStatus } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const force = params.get("force") === "1";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearError = () => error && setError("");

  const handleSubmit = async () => {
    setError("");
    if (!current) {
      setError("请输入当前密码。");
      return;
    }
    if (next.length < 8 || next.length > 32) {
      setError("新密码长度需为 8-32 个字符。");
      return;
    }
    if (next !== confirm) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (next === current) {
      setError("新密码不能与当前密码相同。");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      // 刷新 user（mustChangePassword -> false），守卫放行后跳首页
      await refreshStatus();
      navigate("/", { replace: true });
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "修改密码失败。"
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
            <BlurText as="h1" text="修改密码" stagger={40} className="mt-3 text-h1 font-display text-text" />
            <p className="mt-2 text-sm text-text-muted">定期更换密码更安全</p>
          </div>

          {force && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning ring-1 ring-warning/30"
              role="status"
            >
              首次登录，请修改初始密码后继续使用。
            </motion.div>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label="当前密码">
              <Input
                type="password"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  clearError();
                }}
                autoComplete="current-password"
              />
            </Field>
            <Field label="新密码" hint="8-32 个字符">
              <Input
                type="password"
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  clearError();
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
                  clearError();
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
              {loading ? "提交中..." : "确认修改"}
            </MagneticButton>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
