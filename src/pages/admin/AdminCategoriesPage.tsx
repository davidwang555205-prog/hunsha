/**
 * AdminCategoriesPage -- 类目管理（V2，苹果风格）
 *
 * 路由 /admin/categories。CRUD 内容类目：
 * - 列表（名称/图标/engine/排序/状态）
 * - 创建/编辑（名称/图标/engine/排序/启用/config）
 *
 * 注意：默认"婚纱-小红书"类目对应 bridal_fashion 引擎，核心资产不动。
 */
import { useEffect, useState } from "react";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { Category } from "../../types/api";
import { AdminSubNav } from "../../components/admin/AdminSubNav";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { inputClass } from "../../studio/constants";

type CategoryDraft = {
  name: string;
  icon: string;
  engine: string;
  sortOrder: string;
  isEnabled: boolean;
};

const emptyDraft: CategoryDraft = {
  name: "",
  icon: "",
  engine: "bridal_fashion",
  sortOrder: "0",
  isEnabled: true
};

const engineOptions = [
  { value: "bridal_fashion", label: "婚纱礼服内容引擎（bridal_fashion）" }
];

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const payload = await listCategories();
      setCategories(payload.categories);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategories();
  }, []);

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      icon: c.icon,
      engine: c.engine,
      sortOrder: String(c.sortOrder),
      isEnabled: c.isEnabled
    });
    setShowCreate(false);
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage("");
    try {
      const body = {
        name: draft.name,
        icon: draft.icon,
        engine: draft.engine,
        sortOrder: Number(draft.sortOrder) || 0,
        isEnabled: draft.isEnabled
      };
      if (editingId) {
        await updateCategory(editingId, body);
        setMessage("已更新类目。");
      } else {
        await createCategory(body);
        setMessage("已创建类目。");
      }
      setEditingId(null);
      setShowCreate(false);
      setDraft(emptyDraft);
      await fetchCategories();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除该类目？已关联的任务不受影响。")) return;
    setBusy(true);
    try {
      await deleteCategory(id);
      setMessage("已删除类目。");
      await fetchCategories();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="类目管理"
        subtitle="配置内容类目，当前默认「婚纱-小红书」"
        actions={
          <Button variant="primary" size="sm" onClick={() => { setShowCreate((v) => !v); setEditingId(null); setDraft(emptyDraft); }}>
            {showCreate ? "取消" : "新增类目"}
          </Button>
        }
      />
      <AdminSubNav />

      {message && <div className="rounded-md bg-bg px-3 py-2 text-sm text-text-muted ring-1 ring-border">{message}</div>}

      {(showCreate || editingId) && (
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-text">{editingId ? "编辑类目" : "新建类目"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="类目名称">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="婚纱-小红书" />
            </Field>
            <Field label="图标（emoji）">
              <Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="👰" />
            </Field>
            <Field label="内容引擎">
              <select className={inputClass} value={draft.engine} onChange={(e) => setDraft({ ...draft, engine: e.target.value })}>
                {engineOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="排序">
              <Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
            </Field>
            <Field label="启用">
              <label className="flex items-center gap-2 pt-2.5">
                <input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} />
                <span className="text-sm text-text">{draft.isEnabled ? "启用" : "禁用"}</span>
              </label>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} loading={busy} disabled={!draft.name}>保存</Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setShowCreate(false); setDraft(emptyDraft); }}>取消</Button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["类目", "引擎", "排序", "状态", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-3 px-4 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="px-4 py-3">
                    <span className="mr-2">{c.icon}</span>
                    <span className="font-medium text-text">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{c.engine}</td>
                  <td className="px-4 py-3 text-text">{c.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.isEnabled ? "bg-success/10 text-success" : "bg-bg text-text-muted"}`}>
                      {c.isEnabled ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(c)}>编辑</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} loading={busy}>删除</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && !isLoading && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-text-muted">暂无类目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
