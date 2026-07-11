/**
 * LoginPage -- 登录页（品牌视觉：GlassCard + BlurText 标题 + MagneticButton CTA）
 *
 * 焦点：品牌 Logo + 流光副标题 + 逐字渐显主标题 + 磁吸登录按钮。
 * 已登录访问 /login 重定向到 / 或 /admin。
 * 错误态带轻微 shake 动效。
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { BlurText } from "../components/motion/BlurText";
import { ShinyText } from "../components/motion/ShinyText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import logo from "../assets/logo.jpg";

export function LoginPage() {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 监听 401 被动登出错误（AuthContext 触发自定义事件）
  useEffect(() => {
    const handler = (event: Event) => {
      setError((event as CustomEvent<string>).detail || "登录已失效。");
    };
    window.addEventListener("auth:logout-error", handler);
    return () => window.removeEventListener("auth:logout-error", handler);
  }, []);

  // 已登录重定向（admin -> /admin，否则 /）。置于所有 hooks 之后，符合 Rules of Hooks。
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin" : "/"} replace />;
  }

  // 来源路径（守卫跳转时携带）
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-text">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient p-1 shadow-md">
            <img src={logo} alt="Bridal & Dress" className="h-full w-full rounded-md object-cover" />
          </div>
          <ShinyText duration={4} className="font-display text-sm uppercase tracking-[0.24em] text-text-muted">
            Bridal &amp; Dress
          </ShinyText>
          <BlurText as="h1" text="账号登录" stagger={40} className="mt-3 text-h1 font-display text-text" />
          <p className="mt-2 text-sm text-text-muted">{from ? "登录以继续" : "婚纱礼服内容生成平台"}</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <Field label="账号">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </Field>
          <Field label="密码">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <motion.p
              initial={{ x: -6 }}
              animate={{ x: [0, -6, 6, -4, 4, 0] }}
              transition={{ duration: 0.32 }}
              className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20"
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
            {loading ? "登录中..." : "登录"}
          </MagneticButton>
        </form>
      </GlassCard>
    </main>
  );
}
