/**
 * AdminUsersPage -- 用户管理（V2，苹果风格）
 *
 * 路由 /admin/users。功能：
 * - 用户列表（用户名/显示名/角色/积分/今日已用/总请求/成功率/最近活跃）
 * - 创建用户（含角色、初始积分、每日上限、可用线路）
 * - 编辑用户（角色、积分、禁用、密码、每日上限）
 * - 积分充值/调整
 * - 删除用户（super_admin）
 *
 * 复用 V2 admin API：listAccounts/createUser/updateUser/deleteUser/adjustCredits。
 */
import { Fragment, useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import {
  createUser,
  updateUser,
  deleteUser,
  adjustCredits
} from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { UserRole } from "../../types/api";
import { AdminSubNav } from "../../components/admin/AdminSubNav";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { inputClass } from "../../studio/constants";
import { formatDate } from "../../lib/format";

type Draft = {
  displayName: string;
  role: UserRole;
  credits: string;
  dailyImageLimit: string;
  isDisabled: boolean;
  password: string;
  creditAmount: string;
  creditDesc: string;
};

const emptyDraft: Draft = {
  displayName: "",
  role: "user",
  credits: "100",
  dailyImageLimit: "20",
  isDisabled: false,
  password: "",
  creditAmount: "",
  creditDesc: ""
};

export function AdminUsersPage() {
  const { accounts, refresh, setAccounts } = useData();
  const { session, isSuperAdmin } = useAuth();
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // 新建账号表单
  const [nu, setNu] = useState({ username: "", displayName: "", password: "", dailyImageLimit: "20", credits: "100", role: "user" as UserRole });

  const draftOf = (userId: string): Draft => drafts[userId] ?? emptyDraft;
  const setDraft = (userId: string, patch: Partial<Draft>) =>
    setDrafts((cur) => ({ ...cur, [userId]: { ...draftOf(userId), ...patch } }));

  const handleCreate = async () => {
    setMessage("");
    try {
      const payload = await createUser({
        username: nu.username,
        displayName: nu.displayName || undefined,
        password: nu.password,
        dailyImageLimit: Math.max(0, Math.floor(Number(nu.dailyImageLimit) || 0)),
        credits: Math.max(0, Math.floor(Number(nu.credits) || 0)),
        role: nu.role
      });
      setAccounts(payload.accounts || []);
      setNu({ username: "", displayName: "", password: "", dailyImageLimit: "20", credits: "100", role: "user" });
      setMessage(`已创建账号：${payload.user.username}`);
      await refresh();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "创建账号失败。");
    }
  };

  const handleSave = async (userId: string) => {
    const d = draftOf(userId);
    setBusyUserId(userId);
    setMessage("");
    try {
      const payload = await updateUser(userId, {
        displayName: d.displayName || undefined,
        role: d.role,
        credits: d.credits !== "" ? Math.max(0, Math.floor(Number(d.credits))) : undefined,
        dailyImageLimit: d.dailyImageLimit !== "" ? Math.max(0, Math.floor(Number(d.dailyImageLimit))) : undefined,
        isDisabled: d.isDisabled,
        password: d.password || undefined
      });
      setAccounts(payload.accounts || []);
      setEditingId(null);
      setMessage(`已更新 ${payload.user.username} 的信息。`);
      await refresh();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "更新失败。");
    } finally {
      setBusyUserId("");
    }
  };

  const handleAdjustCredits = async (userId: string) => {
    const d = draftOf(userId);
    const amount = Math.floor(Number(d.creditAmount));
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("积分调整数量需为非零数字。");
      return;
    }
    setBusyUserId(userId);
    setMessage("");
    try {
      const payload = await adjustCredits(userId, { amount, description: d.creditDesc || undefined });
      setAccounts(payload.accounts || []);
      setDraft(userId, { creditAmount: "", creditDesc: "" });
      setMessage(`已调整 ${payload.user.username} 的积分，当前余额 ${payload.balance}。`);
      await refresh();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "调整积分失败。");
    } finally {
      setBusyUserId("");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!isSuperAdmin) {
      setMessage("仅超级管理员可删除账号。");
      return;
    }
    if (!window.confirm("确认删除该账号？此操作不可撤销。")) return;
    setBusyUserId(userId);
    setMessage("");
    try {
      const payload = await deleteUser(userId);
      setAccounts(payload.accounts || []);
      setMessage("已删除账号。");
      await refresh();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "删除失败。");
    } finally {
      setBusyUserId("");
    }
  };

  const roleLabel = (r: UserRole) => (r === "super_admin" ? "超管" : r === "admin" ? "管理员" : "用户");

  return (
    <>
      <PageHeader title="用户管理" subtitle="创建账号、管理角色与积分" />
      <AdminSubNav />

      {/* 创建账号 */}
      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-text">创建新账号</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="账号">
            <Input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} placeholder="username" />
          </Field>
          <Field label="显示名">
            <Input value={nu.displayName} onChange={(e) => setNu({ ...nu, displayName: e.target.value })} />
          </Field>
          <Field label="密码">
            <Input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          </Field>
          <Field label="角色">
            <select className={inputClass} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as UserRole })}>
              <option value="user">用户</option>
              <option value="admin">管理员</option>
              {isSuperAdmin && <option value="super_admin">超级管理员</option>}
            </select>
          </Field>
          <Field label="初始积分">
            <Input type="number" value={nu.credits} onChange={(e) => setNu({ ...nu, credits: e.target.value })} />
          </Field>
          <Field label="每日上限">
            <Input type="number" value={nu.dailyImageLimit} onChange={(e) => setNu({ ...nu, dailyImageLimit: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={!nu.username || !nu.password}>
            创建账号
          </Button>
          {message && <span className="text-sm text-text-muted">{message}</span>}
        </div>
      </section>

      {/* 用户列表 */}
      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">账号列表（{accounts.length}）</h2>
        </div>
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr>
                {["账号", "角色", "积分", "请求", "图片", "今日", "最近活跃", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-2 px-3 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const isEditing = editingId === a.user.id;
                const d = draftOf(a.user.id);
                const isSelf = a.user.id === session?.user.id;
                return (
                  <Fragment key={a.user.id}>
                    <tr className="border-b border-border/50 hover:bg-bg">
                      <td className="px-3 py-3">
                        <div className="font-medium text-text">{a.user.displayName || a.user.username}</div>
                        <div className="text-xs text-text-muted">@{a.user.username}{a.user.isDisabled && " · 已禁用"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-text-muted">{roleLabel(a.user.role)}</span>
                      </td>
                      <td className="px-3 py-3 text-text">{a.credits}</td>
                      <td className="px-3 py-3 text-text">{a.requestCount}</td>
                      <td className="px-3 py-3 text-text">{a.generatedImageCount}</td>
                      <td className="px-3 py-3 text-text">{a.dailyGeneratedImageCount}</td>
                      <td className="px-3 py-3 text-xs text-text-muted">{a.lastGeneratedAt ? formatDate(a.lastGeneratedAt) : "-"}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => { setEditingId(isEditing ? null : a.user.id); setDraft(a.user.id, { ...emptyDraft, displayName: a.user.displayName, role: a.user.role, credits: String(a.credits), dailyImageLimit: String(a.user.dailyImageLimit), isDisabled: a.user.isDisabled }); }}>
                            {isEditing ? "收起" : "编辑"}
                          </Button>
                          {isSuperAdmin && !isSelf && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(a.user.id)} loading={busyUserId === a.user.id}>
                              删除
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-bg/50">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            <Field label="显示名">
                              <Input value={d.displayName} onChange={(e) => setDraft(a.user.id, { displayName: e.target.value })} />
                            </Field>
                            <Field label="角色">
                              <select className={inputClass} value={d.role} onChange={(e) => setDraft(a.user.id, { role: e.target.value as UserRole })}>
                                <option value="user">用户</option>
                                <option value="admin">管理员</option>
                                {isSuperAdmin && <option value="super_admin">超级管理员</option>}
                              </select>
                            </Field>
                            <Field label="积分余额">
                              <Input type="number" value={d.credits} onChange={(e) => setDraft(a.user.id, { credits: e.target.value })} />
                            </Field>
                            <Field label="每日上限">
                              <Input type="number" value={d.dailyImageLimit} onChange={(e) => setDraft(a.user.id, { dailyImageLimit: e.target.value })} />
                            </Field>
                            <Field label="重置密码">
                              <Input type="password" value={d.password} onChange={(e) => setDraft(a.user.id, { password: e.target.value })} placeholder="留空不改" />
                            </Field>
                            <Field label="禁用账号">
                              <label className="flex items-center gap-2 pt-2.5">
                                <input type="checkbox" checked={d.isDisabled} disabled={isSelf} onChange={(e) => setDraft(a.user.id, { isDisabled: e.target.checked })} />
                                <span className="text-sm text-text">{d.isDisabled ? "已禁用" : "启用中"}</span>
                              </label>
                            </Field>
                          </div>
                          {/* 积分调整 */}
                          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                            <Field label="积分调整（正=充值 负=扣减）">
                              <Input type="number" value={d.creditAmount} onChange={(e) => setDraft(a.user.id, { creditAmount: e.target.value })} placeholder="如 100 或 -50" className="w-40" />
                            </Field>
                            <Field label="说明">
                              <Input value={d.creditDesc} onChange={(e) => setDraft(a.user.id, { creditDesc: e.target.value })} placeholder="可选" className="w-48" />
                            </Field>
                            <Button variant="secondary" size="sm" onClick={() => handleAdjustCredits(a.user.id)} loading={busyUserId === a.user.id}>
                              调整积分
                            </Button>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button variant="primary" size="sm" onClick={() => handleSave(a.user.id)} loading={busyUserId === a.user.id}>
                              保存
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>取消</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
