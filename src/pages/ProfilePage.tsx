/**
 * ProfilePage -- 个人中心（RequireAuth）
 *
 * 顶部展示头像 / 昵称 / 用户名 / 角色；积分余额与消耗明细（复用 credits API）。
 * 信息管理入口：修改昵称（行内编辑）、修改头像（上传）、修改密码（/change-password）、
 * 变更邮箱（/profile/email）、变更手机号（/profile/phone）；管理员额外显示后台入口；
 * 提供退出登录。
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateCurrentUser, uploadAvatar } from "../api/users";
import { getCreditBalance } from "../api/credits";
import { listCreditTransactions } from "../api/admin";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { ArrowLeftIcon, CoinIcon, HistoryIcon, ShieldIcon, UsersIcon } from "../components/icons";
import type { ApiError, CreditTransaction } from "../types/api";
import logo from "../assets/logo.png";

const cardClass = "rounded-xl border border-border bg-surface p-5";

export function ProfilePage() {
  const { user, isAdmin, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(true);

  const displayName = user?.displayName || user?.name || "用户";
  const avatarSrc = user?.avatar_url || logo;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCreditBalance(), listCreditTransactions()])
      .then(([b, t]) => {
        if (cancelled) return;
        setBalance(b.balance);
        if (user && b.balance !== user.credits) {
          refreshUser({ ...user, credits: b.balance });
        }
        setTransactions(t.transactions);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCreditsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEditName = () => {
    setNameDraft(user?.name || "");
    setEditingName(true);
    setError("");
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      setError("昵称不能为空。");
      return;
    }
    if (next === user?.name) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    setError("");
    try {
      const { user: updated } = await updateCurrentUser({ name: next });
      refreshUser(updated);
      setEditingName(false);
      setInfo("昵称已更新。");
    } catch (err) {
      setError((err as ApiError | undefined)?.message || "昵称更新失败。");
    } finally {
      setNameSaving(false);
    }
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 前端轻校验：类型 + 大小（后端同样校验，这里只做体验提示）
    if (!/^image\//.test(file.type)) {
      setError("请选择图片文件作为头像。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("头像图片不能超过 5MB。");
      return;
    }
    void uploadAndSaveAvatar(file);
    // 允许再次选择同一文件
    e.target.value = "";
  };

  const uploadAndSaveAvatar = async (file: File) => {
    setAvatarLoading(true);
    setError("");
    try {
      const url = await uploadAvatar(file);
      const { user: updated } = await updateCurrentUser({ avatar_url: url });
      refreshUser(updated);
      setInfo("头像已更新。");
    } catch (err) {
      setError((err as ApiError | undefined)?.message || "头像上传失败。");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-bg hover:text-text"
          aria-label="返回"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="text-h2 font-display">个人中心</h1>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary ring-1 ring-primary/20" role="status">
          {info}
        </p>
      )}

      {/* 资料卡 */}
      <section className={cardClass + " mb-5"}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15 transition hover:ring-primary/40"
            aria-label="修改头像"
          >
            <img src={avatarSrc} alt="头像" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] font-medium text-white">
              {avatarLoading ? "上传中" : "修改"}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameDraft}
                  autoFocus
                  maxLength={32}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="max-w-[240px]"
                />
                <Button size="sm" onClick={() => void saveName()} loading={nameSaving}>
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} disabled={nameSaving}>
                  取消
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{displayName}</h2>
                <button
                  type="button"
                  onClick={startEditName}
                  className="text-xs font-medium text-primary transition hover:text-primary-600"
                >
                  修改昵称
                </button>
              </div>
            )}
            <p className="mt-0.5 truncate text-sm text-text-muted">@{user.username}</p>
            <span className="mt-1 inline-block rounded-full bg-bg px-2 py-0.5 text-xs text-text-muted">
              {isAdmin ? "管理员" : "普通用户"}
            </span>
          </div>
        </div>
      </section>

      {/* 账户信息 */}
      <section className={cardClass + " mb-5"}>
        <h3 className="mb-3 text-sm font-medium text-text-muted">账户信息</h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <UsersIcon size={16} /> 手机号
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{user.phone || "未绑定"}</span>
              <Link to="/profile/phone" className="text-xs font-medium text-primary hover:text-primary-600">
                变更
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5">
            <div className="text-sm text-text-muted">邮箱</div>
            <div className="flex items-center gap-2">
              <span className="max-w-[180px] truncate text-sm">{user.email || "未绑定"}</span>
              <Link to="/profile/email" className="text-xs font-medium text-primary hover:text-primary-600">
                变更
              </Link>
            </div>
          </div>
        </dl>
      </section>

      {/* 积分 */}
      <section className={cardClass + " mb-5"}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <CoinIcon size={16} /> 积分余额
          </h3>
          {balance !== null && <span className="text-2xl font-bold text-primary">{balance}</span>}
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <HistoryIcon size={16} /> 消耗明细
        </div>
        <div className="brand-scrollbar mt-2 max-h-72 overflow-y-auto pr-2">
          {creditsLoading ? (
            <div className="flex justify-center py-6 text-text-subtle">
              <Spinner size={20} />
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-subtle">暂无明细</p>
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-text">{t.description || t.type}</p>
                  <p className="text-xs text-text-subtle">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <span className={`ml-2 shrink-0 font-medium ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 安全与账户 */}
      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-medium text-text-muted">安全与账户</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/change-password"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ring-1 ring-border transition hover:bg-bg"
          >
            <span>修改密码</span>
            <span className="text-text-subtle">›</span>
          </Link>
          <Link
            to="/profile/email"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ring-1 ring-border transition hover:bg-bg"
          >
            <span>变更邮箱</span>
            <span className="text-text-subtle">›</span>
          </Link>
          <Link
            to="/profile/phone"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ring-1 ring-border transition hover:bg-bg"
          >
            <span>变更手机号</span>
            <span className="text-text-subtle">›</span>
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-primary ring-1 ring-primary/30 transition hover:bg-primary/5"
            >
              <span className="flex items-center gap-1.5">
                <ShieldIcon size={16} /> 进入后台管理
              </span>
              <span className="text-text-subtle">›</span>
            </Link>
          )}
        </div>
        <Button variant="danger" block className="mt-4" onClick={handleLogout}>
          退出登录
        </Button>
      </section>
    </main>
  );
}
