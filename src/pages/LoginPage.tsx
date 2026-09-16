/**
 * LoginPage -- 登录页（品牌视觉：GlassCard + BlurText 标题 + MagneticButton CTA）
 *
 * 焦点：品牌 Logo + 流光副标题 + 逐字渐显主标题 + 磁吸登录按钮。
 * 已登录访问 /login 重定向到 / 或 /admin。
 * 错误态带轻微 shake 动效。
 *
 * team cookie session：email + password 登录（captcha 开发阶段后端放宽，前端暂不接）。
 */
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import type { ApiError } from "../types/api";
import { BlurText } from "../components/motion/BlurText";
import { GradientText } from "../components/motion/GradientText";
import { GlassCard } from "../components/motion/GlassCard";
import { MagneticButton } from "../components/motion/MagneticButton";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { CaptchaWidget } from "../components/auth/CaptchaWidget";
import logo from "../assets/logo.png";

type LoginErrorKind = "credentials" | "network" | "validation" | "session" | null;

export function LoginPage() {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<LoginErrorKind>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 监听 401 被动登出错误（AuthContext 触发自定义事件）
  useEffect(() => {
    const handler = (event: Event) => {
      setError((event as CustomEvent<string>).detail || "登录已失效。");
      setErrorKind("session");
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

  const handleCaptchaToken = (token: string) => {
    setCaptchaToken(token);
  };

  const handleCaptchaError = (_code: string, message: string) => {
    setCaptchaToken(null);
    setCaptchaResetSignal((s) => s + 1);
    setError(message || "人机验证失败，请重试。");
    setErrorKind("validation");
  };

  const handleSubmit = async () => {
    setError("");
    setErrorKind(null);
    // 前端空值校验，避免空请求打到后端
    if (!account.trim() || !password) {
      setError("请输入账号和密码。");
      setErrorKind("validation");
      return;
    }
    if (!captchaToken) {
      setError("请先完成人机验证。");
      setErrorKind("validation");
      return;
    }
    setLoading(true);
    try {
      await login(account, password, captchaToken);
      setPassword("");
      setCaptchaToken(null);
      setCaptchaResetSignal((s) => s + 1);
    } catch (err) {
      // 网络错误（statusCode 缺失）单独提示；业务错误（含 HTTP 200 的登录失败）统一友好文案，
      // 不暴露后端技术性 message，也不泄露邮箱是否存在。保留密码并选中，方便用户直接修正输入。
      const statusCode = (err as ApiError | undefined)?.statusCode;
      if (statusCode === undefined) {
        setError("无法连接服务，请检查网络后重试。");
        setErrorKind("network");
      } else if (statusCode === 403) {
        // 403=后端 Cap token 校验失败（token 一次性，上次失败后未重新过验证即失效）。
        // 与密码错误区分提示，并重置验证码 widget 引导用户重新验证，避免"越试越失败"。
        setCaptchaToken(null);
        setCaptchaResetSignal((s) => s + 1);
        setError("人机验证已失效，请重新完成验证后再登录。");
        setErrorKind("validation");
      } else {
        setError("邮箱或密码不正确，请检查后重试。");
        setErrorKind("credentials");
        requestAnimationFrame(() => passwordRef.current?.select());
      }
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
              <Input
                type="text"
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
                  // account 改变：清空已通过的人机验证，防止 A 账号验证码提交到 B 账号
                  setCaptchaToken(null);
                  setCaptchaResetSignal((s) => s + 1);
                  if (error) {
                    setError("");
                    setErrorKind(null);
                  }
                }}
                autoComplete="username"
                placeholder="邮箱或手机号"
              />
            </Field>
            <Field label="密码">
              <Input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) {
                    setError("");
                    setErrorKind(null);
                  }
                }}
                autoComplete="current-password"
                error={errorKind === "credentials"}
                aria-invalid={errorKind === "credentials"}
              />
            </Field>

            <Field label="人机验证" hint={captchaToken ? "✓ 已通过" : "请完成验证再登录"}>
              <CaptchaWidget
                key={captchaResetSignal}
                onToken={handleCaptchaToken}
                onError={handleCaptchaError}
              />
            </Field>

            {error && (
              <motion.p
                initial={{ x: -6 }}
                animate={{ x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.32 }}
                className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20"
                role="alert"
                aria-live="assertive"
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

            <div className="flex items-center justify-between text-sm text-text-muted">
              <Link to="/register" className="font-medium text-primary transition hover:text-primary-600">
                注册账号
              </Link>
              <Link to="/forgot-password" className="transition hover:text-primary">
                忘记密码？
              </Link>
            </div>
          </form>
        </GlassCard>
      </div>

      <footer className="shrink-0 pt-6 text-center text-xs text-text-muted">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          蜀ICP备2026040143号
        </a>
      </footer>
    </main>
  );
}
