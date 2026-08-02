/**
 * AdminUsersPage -- 用户管理（team MemberList）
 *
 * 路由 /admin/users。功能：
 * - 成员列表（listMembers，分页 + 搜索）
 * - 创建成员（手机号批量 + dailyImageLimit，返回初始密码，结构化展示 + 复制）
 * - 编辑成员（name/dailyImageLimit + 重置密码）
 * - 删除成员（admin）
 * - 列表行：Switch 停用/启用即时切换、积分调整弹窗、积分流水跳转
 *
 * 账号标识统一为手机号（与注册一致）；老 email 用户用 phone || email 兜底显示。
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listMembers, listAllCategories, createUser, updateUser, deleteUser, adjustCredits, resetPassword } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { ApiUser, Category, TeamMemberInfo, TeamUserPassword } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Switch } from "../../components/ui/Switch";
import { Pagination } from "../../components/ui/Pagination";
import { inputClass } from "../../studio/constants";
import { formatDate, pickUserLabel } from "../../lib/format";
import { copyText } from "../../lib/clipboard";

// 账号标识：手机号优先，老 email 用户兜底（兼容历史数据）
const accountOf = (u: ApiUser): string => u.phone || u.email || u.username || u.displayName || u.id;

export function AdminUsersPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TeamMemberInfo | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 创建表单（team：手机号批量 + dailyImageLimit + maxActiveTasks）
  const [nu, setNu] = useState({
    phones: "",
    dailyImageLimit: "20",
    maxActiveTasks: "5"
  });

  // 编辑表单（name/dailyImageLimit/maxActiveTasks；停用启用走列表行开关，积分走独立弹窗）
  const [ed, setEd] = useState({
    name: "",
    dailyImageLimit: "20",
    maxActiveTasks: "5",
    visibleCategoryIds: [] as string[]
  });

  // 创建后初始密码（结构化展示 + 复制，仅显示一次）
  const [createdPasswords, setCreatedPasswords] = useState<TeamUserPassword[] | null>(null);
  // 重置密码结果（仅显示一次）
  const [resetResult, setResetResult] = useState<TeamUserPassword | null>(null);
  // 积分调整弹窗目标
  const [creditTarget, setCreditTarget] = useState<TeamMemberInfo | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: "", desc: "" });

  const fetchMembers = useCallback(async (p: number, size: number, q: string) => {
    try {
      const payload = await listMembers(p, size, q.trim() || undefined);
      setMembers(payload.members);
      setTotal(payload.total);
      setPage(payload.page || p);
      setPageSize(size);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载成员失败。");
    }
  }, []);

  const reload = () => fetchMembers(page, pageSize, query);

  // 搜索防抖（含初始加载）：query 变化 500ms 后查第 1 页（与 HistoryPage 一致）
  useEffect(() => {
    const t = setTimeout(() => void fetchMembers(1, pageSize, query), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    void listAllCategories()
      .then((payload) => setCategories(payload.categories))
      .catch((err: unknown) => {
        if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载类目失败。");
      });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openEdit = (m: TeamMemberInfo) => {
    void listAllCategories().then((payload) => setCategories(payload.categories)).catch(() => undefined);
    setEditing(m);
    setEd({
      name: m.user.displayName || m.user.name || "",
      dailyImageLimit: String(m.user.dailyImageLimit ?? 0),
      maxActiveTasks: String(m.user.maxActiveTasks ?? 5),
      visibleCategoryIds: m.user.visibleCategoryIds ?? []
    });
    setResetResult(null);
    setMessage("");
  };

  const handleCreate = async () => {
    const phones = nu.phones
      .split(/[\s,，;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      setMessage("请输入至少一个手机号。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload = await createUser({
        phones,
        dailyImageLimit: Math.max(0, Math.floor(Number(nu.dailyImageLimit) || 0)),
        maxActiveTasks: Math.max(0, Math.floor(Number(nu.maxActiveTasks) || 0))
      });
      setNu({ phones: "", dailyImageLimit: "20", maxActiveTasks: "5" });
      setShowCreate(false);
      setCreatedPasswords(payload.passwords);
      setMessage(`已创建 ${payload.users.length} 个成员，请复制保存初始密码。`);
      await reload();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "创建成员失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await updateUser(editing.user.id, {
        name: ed.name || undefined,
        dailyImageLimit: ed.dailyImageLimit !== "" ? Math.max(0, Math.floor(Number(ed.dailyImageLimit))) : undefined,
        maxActiveTasks: ed.maxActiveTasks !== "" ? Math.max(0, Math.floor(Number(ed.maxActiveTasks))) : undefined,
        visibleCategoryIds: ed.visibleCategoryIds
      });
      setEditing(null);
      setMessage(`已更新 ${accountOf(payload.user)} 的信息。`);
      await reload();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "更新失败。");
    } finally {
      setBusy(false);
    }
  };

  // 列表行开关：停用/启用即时切换（不可停用自己）
  const handleToggleBlocked = async (m: TeamMemberInfo) => {
    if (m.user.id === user?.id) return;
    setBusy(true);
    setMessage("");
    try {
      await updateUser(m.user.id, { is_blocked: !m.user.is_blocked });
      setMessage(`${accountOf(m.user)} 已${m.user.is_blocked ? "启用" : "停用"}。`);
      await reload();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  };

  // 积分调整（独立弹窗）
  const handleAdjustCredits = async () => {
    if (!creditTarget) return;
    const amount = Math.floor(Number(creditForm.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("积分调整数量需为非零数字。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload = await adjustCredits(creditTarget.user.id, { amount, description: creditForm.desc || undefined });
      setCreditForm({ amount: "", desc: "" });
      setCreditTarget(null);
      setMessage(`已调整 ${accountOf(creditTarget.user)} 的积分，当前余额 ${payload.balance}。`);
      await reload();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "调整积分失败。");
    } finally {
      setBusy(false);
    }
  };

  // 重置密码（后端生成新随机密码，返回明文一次）
  const handleResetPassword = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await resetPassword(editing.user.id);
      setResetResult(result);
      setMessage(`已重置 ${result.account} 的密码，请复制保存。`);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "重置密码失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("确认删除该成员？此操作不可撤销。")) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteUser(userId);
      setMessage("已删除成员。");
      await reload();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  };

  const copyAllPasswords = async (list: TeamUserPassword[]) => {
    const text = list.map((p) => `${p.account} : ${p.password}`).join("\n");
    await copyText(text);
    setMessage("已复制全部账号密码。");
  };

  const roleLabel = (m: TeamMemberInfo) =>
    m.user.role === "enterprise"
      ? "所有者"
      : m.user.role === "admin"
        ? "管理员"
        : m.role === "admin"
          ? "组管理员"
          : "成员";

  const toggleVisibleCategory = (categoryId: string) => {
    setEd((current) => ({
      ...current,
      visibleCategoryIds: current.visibleCategoryIds.includes(categoryId)
        ? current.visibleCategoryIds.filter((id) => id !== categoryId)
        : [...current.visibleCategoryIds, categoryId]
    }));
  };

  return (
    <>
      <PageHeader
        title="用户管理"
        subtitle="创建成员、管理额度与积分"
        actions={
          <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); setMessage(""); }}>
            创建新成员
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索手机号 / 邮箱 / 显示名"
          className="w-64"
        />
        {message && (
          <div
            className="ml-auto max-w-md truncate rounded-md bg-bg px-3 py-2 text-sm text-text-muted ring-1 ring-border"
            title={message}
          >
            {message}
          </div>
        )}
      </div>

      {/* 成员列表 */}
      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">成员列表（{total}）</h2>
        </div>
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr>
                {["成员", "角色", "积分", "每日额度", "状态", "最近活跃", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border px-3 py-2 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.user.id === user?.id;
                return (
                  <tr key={m.user.id} className="border-b border-border/50 hover:bg-bg">
                    <td className="px-3 py-3">
                      <div className="font-medium text-text">{pickUserLabel(m.user)}</div>
                      <div className="text-xs text-text-muted">{accountOf(m.user)}</div>
                    </td>
                    <td className="px-3 py-3"><span className="rounded-full bg-bg px-2 py-0.5 text-xs text-text-muted">{roleLabel(m)}</span></td>
                    <td className="px-3 py-3">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => navigate(`/admin/credits?userId=${encodeURIComponent(m.user.id)}`)}
                        title="查看该成员积分流水"
                      >
                        {m.user.credits}
                      </Button>
                    </td>
                    <td className="px-3 py-3 text-text">
                      {m.user.role === "enterprise" || m.user.role === "admin" ? "不限" : m.user.dailyImageLimit}
                    </td>
                    <td className="px-3 py-3">
                      <Switch
                        checked={!m.user.is_blocked}
                        onChange={() => void handleToggleBlocked(m)}
                        disabled={isSelf || busy}
                        label={m.user.is_blocked ? "点击启用" : "点击停用"}
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-text-muted">
                      {m.last_active_at ? formatDate(new Date(m.last_active_at * 1000).toISOString()) : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="secondary" size="sm" onClick={() => { setCreditTarget(m); setCreditForm({ amount: "", desc: "" }); setMessage(""); }}>积分</Button>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(m)}>编辑</Button>
                        {isAdmin && !isSelf && (
                          <Button variant="ghost" size="sm" onClick={() => void handleDelete(m.user.id)} loading={busy}>删除</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-text-muted">暂无匹配成员</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={[12, 20, 50]}
            onPageChange={(p) => void fetchMembers(p, pageSize, query)}
            onPageSizeChange={(s) => void fetchMembers(1, s, query)}
          />
        </div>
      </section>

      {/* 创建成员弹窗 */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="创建新成员"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={busy} disabled={!nu.phones}>创建</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="手机号（多个用空格/逗号分隔，批量创建 subaccount 成员）">
            <textarea
              className={inputClass}
              rows={3}
              value={nu.phones}
              onChange={(e) => setNu({ ...nu, phones: e.target.value })}
              placeholder="13800138000, 13900139000"
            />
          </Field>
          <Field label="每日生图上限（enterprise/admin 不受限，此值对 subaccount 生效）">
            <Input type="number" value={nu.dailyImageLimit} onChange={(e) => setNu({ ...nu, dailyImageLimit: e.target.value })} />
          </Field>
          <Field label="异步任务上限（enterprise/admin 不受限，此值对 subaccount 生效）">
            <Input type="number" value={nu.maxActiveTasks} onChange={(e) => setNu({ ...nu, maxActiveTasks: e.target.value })} />
          </Field>
          <p className="text-xs text-text-muted">创建后后端生成随机初始密码，仅在弹窗中显示一次，请及时复制保存。成员首登需修改初始密码。</p>
        </div>
      </Modal>

      {/* 创建后初始密码展示弹窗 */}
      <Modal
        open={!!createdPasswords}
        onClose={() => setCreatedPasswords(null)}
        title="初始密码（请立即复制保存）"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => void copyAllPasswords(createdPasswords ?? [])}>全部复制</Button>
            <Button variant="primary" size="sm" onClick={() => setCreatedPasswords(null)}>我已保存</Button>
          </>
        }
      >
        <div className="space-y-2">
          {createdPasswords?.map((p) => (
            <div key={p.account} className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-text">{p.account}</div>
                <div className="truncate font-mono text-text-muted">{p.password}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={async () => { await copyText(`${p.account} : ${p.password}`); setMessage(`已复制 ${p.account}。`); }}>复制</Button>
            </div>
          ))}
          <p className="text-xs text-danger">⚠️ 密码仅显示一次，关闭后将无法再次查看，请务必复制保存。</p>
        </div>
      </Modal>

      {/* 编辑成员弹窗 */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="编辑成员"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={busy}>保存</Button>
          </>
        }
      >
        {editing && (
          <>
            <p className="mb-4 text-xs text-text-muted">{accountOf(editing.user)}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="显示名"><Input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Field>
              <Field label="每日限制"><Input type="number" value={ed.dailyImageLimit} onChange={(e) => setEd({ ...ed, dailyImageLimit: e.target.value })} /></Field>
              <Field label="异步任务上限"><Input type="number" value={ed.maxActiveTasks} onChange={(e) => setEd({ ...ed, maxActiveTasks: e.target.value })} /></Field>
            </div>
            <Field label="可见类目">
              <div className="rounded-md border border-border bg-bg/50 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={ed.visibleCategoryIds.length === 0}
                    onChange={() => setEd((current) => ({ ...current, visibleCategoryIds: [] }))}
                  />
                  全部启用类目
                </label>
                <p className="mt-1 text-xs text-text-muted">勾选任意类目后将按所选范围展示；未勾选任何类目时默认全部可见。</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => {
                    const checked = ed.visibleCategoryIds.includes(category.id);
                    return (
                      <label key={category.id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                        <input type="checkbox" checked={checked} onChange={() => toggleVisibleCategory(category.id)} />
                        <span>{category.icon} {category.name}{!category.isEnabled ? "（已停用）" : ""}</span>
                      </label>
                    );
                  })}
                  {categories.length === 0 && <span className="text-xs text-text-muted">暂无可配置类目。</span>}
                </div>
              </div>
            </Field>
            <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-bg/50 p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-text">重置密码</p>
                <p className="text-xs text-text-muted">生成新随机密码，原密码立即失效。新密码仅显示一次。</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleResetPassword} loading={busy}>重置密码</Button>
            </div>
          </>
        )}
      </Modal>

      {/* 重置密码结果弹窗 */}
      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="新密码（请立即复制保存）"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={async () => { if (resetResult) { await copyText(`${resetResult.account} : ${resetResult.password}`); setMessage("已复制新密码。"); } }}>复制</Button>
            <Button variant="primary" size="sm" onClick={() => setResetResult(null)}>我已保存</Button>
          </>
        }
      >
        {resetResult && (
          <div className="space-y-2">
            <div className="rounded-md bg-bg px-3 py-2 text-sm">
              <div className="font-medium text-text">{resetResult.account}</div>
              <div className="font-mono text-text-muted">{resetResult.password}</div>
            </div>
            <p className="text-xs text-danger">⚠️ 密码仅显示一次，关闭后将无法再次查看。</p>
          </div>
        )}
      </Modal>

      {/* 积分调整弹窗 */}
      <Modal
        open={!!creditTarget}
        onClose={() => setCreditTarget(null)}
        title="调整积分"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreditTarget(null)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleAdjustCredits} loading={busy}>调整</Button>
          </>
        }
      >
        {creditTarget && (
          <div className="grid gap-3">
            <p className="text-xs text-text-muted">{creditTarget.user.displayName || accountOf(creditTarget.user)}（当前余额 {creditTarget.user.credits}）</p>
            <Field label="数量（正=增加 负=扣减）">
              <Input type="number" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} placeholder="如 100 或 -50" />
            </Field>
            <Field label="说明">
              <Input value={creditForm.desc} onChange={(e) => setCreditForm({ ...creditForm, desc: e.target.value })} placeholder="可选" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
