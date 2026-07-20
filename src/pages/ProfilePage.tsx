/**
 * ProfilePage -- 个人中心（RequireAuth）
 *
 * 宽双栏布局（lg:grid-cols-3）：
 *   左栏（1 列）：资料卡（头像/昵称/角色）+ 账户信息（手机/邮箱，含变更入口）+ 安全与账户（修改密码/退出）
 *   右栏（2 列）：积分余额 + 消耗明细（类型/时间筛选 + 自定义时间范围弹窗）
 * 取消"进入后台管理"按钮（admin 入口在导航/侧栏）；账户信息卡的"变更邮箱/变更手机号"
 * 与"安全与账户"卡原本重复，统一只在账户信息卡内保留变更入口。
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateCurrentUser, uploadAvatar } from "../api/users";
import { getCreditBalance } from "../api/credits";
import { listCreditTransactions } from "../api/admin";
import { changePassword } from "../api/auth";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { Segmented } from "../components/ui/Segmented";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { Pagination } from "../components/ui/Pagination";
import { ChangePhoneModal } from "../components/profile/ChangePhoneModal";
import { ChangeEmailModal } from "../components/profile/ChangeEmailModal";
import { ArrowLeftIcon, CoinIcon, HistoryIcon } from "../components/icons";
import { formatDate } from "../lib/format";
import { inputClass } from "../studio/constants";
import type { ApiError, CreditTransaction } from "../types/api";
import logo from "../assets/logo.png";

const panelClass = "rounded-md bg-surface p-5 shadow-sm ring-1 ring-border";

// 类型徽章：与 AdminCreditsPage 保持一致
const typeLabel: Record<CreditTransaction["type"], { text: string; cls: string }> = {
  recharge: { text: "充值", cls: "bg-success/10 text-success ring-1 ring-success/20" },
  consume: { text: "消费", cls: "bg-danger/10 text-danger ring-1 ring-danger/20" },
  adjust: { text: "调整", cls: "bg-primary/10 text-primary ring-1 ring-primary/20" }
};

type TypeKey = "" | "recharge" | "consume" | "adjust";
type RangeKey = "today" | "7d" | "30d" | "all" | "custom";

const typeOptions: { value: TypeKey; label: string }[] = [
  { value: "", label: "全部" },
  { value: "recharge", label: "充值" },
  { value: "consume", label: "消费" },
  { value: "adjust", label: "调整" }
];

const rangeOptions: { value: RangeKey; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自定义" }
];

// 时间范围 -> RFC3339 区间
function rangeToDates(range: RangeKey): { startTime?: string; endTime?: string } {
  if (range === "all" || range === "custom") return {};
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

// YYYY-MM-DD -> RFC3339（start 00:00:00 / end 23:59:59）
function dateToISO(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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

  // 积分明细分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 积分明细筛选
  const [filterType, setFilterType] = useState<TypeKey>("");
  const [range, setRange] = useState<RangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");

  // 修改密码弹窗（与 ChangePasswordPage 同一套校验，force 首登场景仍走独立页）
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // 变更手机号 / 邮箱弹窗（逻辑封装在独立 Modal 组件内）
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const displayName = user?.displayName || user?.name || "用户";
  const avatarSrc = user?.avatar_url || logo;

  // 拉取积分明细（按筛选 + 分页）。p/ps 用于"切页/切每页条数"覆盖当前状态，
  // 不直接依赖 state 是为了规避 set 后异步读取的时序问题。
  const fetchTransactions = (opts?: {
    type?: TypeKey;
    rangeKey?: RangeKey;
    cStart?: string;
    cEnd?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const t = opts?.type !== undefined ? opts.type : filterType;
    const r = opts?.rangeKey !== undefined ? opts.rangeKey : range;
    const cs = opts?.cStart !== undefined ? opts.cStart : customStart;
    const ce = opts?.cEnd !== undefined ? opts.cEnd : customEnd;
    const p = opts?.page !== undefined ? opts.page : page;
    const ps = opts?.pageSize !== undefined ? opts.pageSize : pageSize;
    const dates = r === "custom" ? { startTime: dateToISO(cs, false), endTime: dateToISO(ce, true) } : rangeToDates(r);
    const filter: { type?: string; startTime?: string; endTime?: string } = {};
    if (t) filter.type = t;
    if (dates.startTime) filter.startTime = dates.startTime;
    if (dates.endTime) filter.endTime = dates.endTime;
    setCreditsLoading(true);
    listCreditTransactions(p, ps, filter)
      .then((r2) => {
        setTransactions(r2.transactions);
        setTotal(r2.total);
        setPage(r2.page);
        setPageSize(r2.pageSize);
      })
      .catch(() => {})
      .finally(() => setCreditsLoading(false));
  };

  // 首次：余额 + 明细（第 1 页）
  useEffect(() => {
    let cancelled = false;
    Promise.all([getCreditBalance(), listCreditTransactions(1, 20)])
      .then(([b, t]) => {
        if (cancelled) return;
        setBalance(b.balance);
        if (user && b.balance !== user.credits) {
          refreshUser({ ...user, credits: b.balance });
        }
        setTransactions(t.transactions);
        setTotal(t.total);
        setPage(t.page);
        setPageSize(t.pageSize);
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

  const refreshBalance = () => {
    getCreditBalance()
      .then((b) => {
        setBalance(b.balance);
        if (user && b.balance !== user.credits) {
          refreshUser({ ...user, credits: b.balance });
        }
      })
      .catch(() => {});
  };

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
    if (!/^image\//.test(file.type)) {
      setError("请选择图片文件作为头像。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("头像图片不能超过 5MB。");
      return;
    }
    void uploadAndSaveAvatar(file);
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

  // 修改密码弹窗：打开时清空表单；提交校验与 ChangePasswordPage 一致
  const openPwdModal = () => {
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    setPwdError("");
    setShowPwdModal(true);
  };

  const submitChangePassword = async () => {
    setPwdError("");
    if (!pwdCurrent) {
      setPwdError("请输入当前密码。");
      return;
    }
    if (pwdNext.length < 8 || pwdNext.length > 32) {
      setPwdError("新密码长度需为 8-32 个字符。");
      return;
    }
    if (pwdNext !== pwdConfirm) {
      setPwdError("两次输入的新密码不一致。");
      return;
    }
    if (pwdNext === pwdCurrent) {
      setPwdError("新密码不能与当前密码相同。");
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword({ current_password: pwdCurrent, new_password: pwdNext });
      setShowPwdModal(false);
      setInfo("密码已更新。");
    } catch (err) {
      const statusCode = (err as ApiError | undefined)?.statusCode;
      setPwdError(
        statusCode === undefined
          ? "无法连接服务，请检查网络后重试。"
          : (err as ApiError | undefined)?.message || "修改密码失败。"
      );
    } finally {
      setPwdLoading(false);
    }
  };

  // 筛选交互：切换类型/时间范围/自定义确认时，回到第 1 页重新查询
  const handleTypeChange = (next: TypeKey) => {
    setFilterType(next);
    fetchTransactions({ type: next, page: 1 });
  };

  const handleRangeChange = (next: RangeKey) => {
    if (next === "custom") {
      setTempStart(customStart);
      setTempEnd(customEnd);
      setShowCustomModal(true);
      return;
    }
    setRange(next);
    fetchTransactions({ rangeKey: next, page: 1 });
  };

  const handleConfirmCustom = () => {
    setCustomStart(tempStart);
    setCustomEnd(tempEnd);
    setRange("custom");
    fetchTransactions({ rangeKey: "custom", cStart: tempStart, cEnd: tempEnd, page: 1 });
    setShowCustomModal(false);
  };

  // 分页：切页 / 切每页条数
  const handlePageChange = (next: number) => {
    fetchTransactions({ page: next });
  };
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    fetchTransactions({ page: 1, pageSize: size });
  };

  // 自定义范围文本提示
  const customRangeLabel =
    range === "custom" && (customStart || customEnd)
      ? `${customStart || "不限"} ~ ${customEnd || "不限"}`
      : null;

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-text">
      <PageHeader
        title="个人中心"
        subtitle="管理资料、账户与积分明细"
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeftIcon size={16} /> 返回
          </Button>
        }
      />

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="mt-4 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary ring-1 ring-primary/20" role="status">
          {info}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 左栏：资料 + 账户信息 + 安全与账户 */}
        <div className="space-y-5 lg:col-span-1">
          {/* 资料卡 */}
          <section className={panelClass}>
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
                      className="max-w-[180px]"
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
                      修改
                    </button>
                  </div>
                )}
                <p className="mt-0.5 truncate text-sm text-text-muted">@{user.username}</p>
                <span className="mt-1.5 inline-block rounded-full bg-bg px-2 py-0.5 text-xs text-text-muted">
                  {isAdmin ? "管理员" : "普通用户"}
                </span>
              </div>
            </div>
          </section>

          {/* 账户信息 */}
          <section className={panelClass}>
            <h3 className="mb-3 text-sm font-medium text-text-muted">账户信息</h3>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>手机号</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{user.phone || "未绑定"}</span>
                  <button
                    type="button"
                    onClick={() => setShowPhoneModal(true)}
                    className="text-xs font-medium text-primary hover:text-primary-600"
                  >
                    变更
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5">
                <div className="text-sm text-text-muted">邮箱</div>
                <div className="flex items-center gap-2">
                  <span className="max-w-[180px] truncate text-sm">{user.email || "未绑定"}</span>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="text-xs font-medium text-primary hover:text-primary-600"
                  >
                    变更
                  </button>
                </div>
              </div>
            </dl>
          </section>

          {/* 安全与账户 */}
          <section className={panelClass}>
            <h3 className="mb-3 text-sm font-medium text-text-muted">安全与账户</h3>
            <button
              type="button"
              onClick={openPwdModal}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm ring-1 ring-border transition hover:bg-bg"
            >
              <span>修改密码</span>
              <span className="text-text-subtle">›</span>
            </button>
            <Button variant="danger" block className="mt-4" onClick={handleLogout}>
              退出登录
            </Button>
          </section>
        </div>

        {/* 右栏：积分余额 + 消耗明细 */}
        <div className="space-y-5 lg:col-span-2">
          <section className={panelClass}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-text-muted">
                  <CoinIcon size={16} /> 积分余额
                </p>
                {balance !== null ? (
                  <p className="mt-1 text-4xl font-bold text-primary">{balance}</p>
                ) : (
                  <div className="mt-2 text-text-subtle">
                    <Spinner size={20} />
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => { refreshBalance(); fetchTransactions(); }}>
                刷新
              </Button>
            </div>

            {/* 筛选区 */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm text-text-muted">
                <HistoryIcon size={16} /> 消耗明细
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-subtle">类型</span>
                <Segmented
                  options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
                  value={filterType}
                  onChange={(v) => handleTypeChange(v as TypeKey)}
                  size="sm"
                />
                <div className="mx-1 h-5 w-px bg-border" />
                <span className="text-xs text-text-subtle">时间</span>
                <Segmented
                  options={rangeOptions.map((o) => ({ value: o.value, label: o.label }))}
                  value={range}
                  onChange={(v) => handleRangeChange(v as RangeKey)}
                  size="sm"
                />
                {customRangeLabel && (
                  <button
                    type="button"
                    onClick={() => { setTempStart(customStart); setTempEnd(customEnd); setShowCustomModal(true); }}
                    className="ml-1 rounded-md bg-bg px-2 py-1 text-xs text-text-muted ring-1 ring-border transition hover:bg-surface"
                  >
                    {customRangeLabel} · 修改
                  </button>
                )}
              </div>

              {/* 明细列表 */}
              <div className="brand-scrollbar mt-3 max-h-[460px] overflow-y-auto pr-1">
                {creditsLoading ? (
                  <div className="flex justify-center py-8 text-text-subtle">
                    <Spinner size={20} />
                  </div>
                ) : transactions.length === 0 ? (
                  <EmptyState title="暂无积分记录" description="当前筛选条件下没有积分变动记录。" />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {transactions.map((t) => {
                      const badge = typeLabel[t.type] ?? typeLabel.adjust;
                      return (
                        <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                                {badge.text}
                              </span>
                              <p className="truncate text-text">{t.description || t.type}</p>
                            </div>
                            <p className="mt-1 text-xs text-text-subtle">{formatDate(t.createdAt)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className={`font-medium ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                              {t.amount >= 0 ? "+" : ""}
                              {t.amount}
                            </span>
                            <span className="text-xs text-text-subtle">余额 {t.balanceAfter}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* 分页器：几万条记录时避免一次性渲染卡死 */}
              {!creditsLoading && transactions.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(total / pageSize))}
                    total={total}
                    pageSize={pageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 自定义时间范围弹窗 */}
      <Modal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="自定义时间范围"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCustomModal(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleConfirmCustom}>确定</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text">开始日期</span>
            <input
              type="date"
              className={inputClass}
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text">结束日期</span>
            <input
              type="date"
              className={inputClass}
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
            />
          </label>
          <p className="text-xs text-text-muted">留空表示不限起止时间。</p>
        </div>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        open={showPwdModal}
        onClose={() => !pwdLoading && setShowPwdModal(false)}
        title="修改密码"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowPwdModal(false)} disabled={pwdLoading}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={() => void submitChangePassword()} loading={pwdLoading}>
              确认修改
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitChangePassword();
          }}
        >
          <Field label="当前密码">
            <Input
              type="password"
              autoComplete="current-password"
              value={pwdCurrent}
              onChange={(e) => { setPwdCurrent(e.target.value); if (pwdError) setPwdError(""); }}
            />
          </Field>
          <Field label="新密码" hint="8-32 个字符">
            <Input
              type="password"
              autoComplete="new-password"
              value={pwdNext}
              onChange={(e) => { setPwdNext(e.target.value); if (pwdError) setPwdError(""); }}
            />
          </Field>
          <Field label="确认新密码">
            <Input
              type="password"
              autoComplete="new-password"
              value={pwdConfirm}
              onChange={(e) => { setPwdConfirm(e.target.value); if (pwdError) setPwdError(""); }}
            />
          </Field>
          {pwdError && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">
              {pwdError}
            </p>
          )}
          {/* 触发表单回车提交 */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      {/* 变更手机号弹窗 */}
      <ChangePhoneModal
        open={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSuccess={() => setInfo("手机号已更新。")}
      />

      {/* 变更邮箱弹窗 */}
      <ChangeEmailModal open={showEmailModal} onClose={() => setShowEmailModal(false)} />
    </main>
  );
}
