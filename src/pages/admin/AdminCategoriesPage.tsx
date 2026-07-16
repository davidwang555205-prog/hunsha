/**
 * AdminCategoriesPage -- 类目管理（V2，苹果风格）
 *
 * 路由 /admin/categories。CRUD 内容类目：
 * - 列表（名称/图标/简介/引擎/排序/状态）-- 管理列表含禁用类目
 * - 创建/编辑（弹窗：名称/简介/图标/内容引擎/排序/启用）
 *
 * 注意：engine 默认 bridal（婚纱礼服内容引擎）。内容引擎选项暂硬编码，
 * WS-7 内容引擎配置化后改为从 /api/engines 拉取。
 */
import { useEffect, useState } from "react";
import { listAllCategories, createCategory, updateCategory, deleteCategory, listEngines, uploadCategoryCover } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { Category, ContentEngine } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Modal } from "../../components/ui/Modal";
import { inputClass } from "../../studio/constants";

type CategoryDraft = {
  name: string;
  description: string;
  icon: string;
  engine: string;
  sortOrder: string;
  isEnabled: boolean;
  coverImages: string[];
};

// 常见类目 icon 预设（emoji），用户点选即可，无需手输
const ICON_PRESETS = ["👰", "👗", "💄", "📷", "💍", "💐", "🍰", "✈️", "🏃", "🍼", "🏠", "🐾", "🎓", "🚗", "⌚", "🛍️"];

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  icon: "",
  engine: "bridal",
  sortOrder: "0",
  isEnabled: true,
  coverImages: []
};

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [engines, setEngines] = useState<ContentEngine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const payload = await listAllCategories();
      setCategories(payload.categories);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEngines = async () => {
    try {
      const payload = await listEngines();
      setEngines(payload.engines);
    } catch {
      // 忽略，下拉为空时兜底 bridal
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategories();
    void fetchEngines();
  }, []);

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      description: c.description ?? "",
      icon: c.icon,
      engine: c.engine || "bridal",
      sortOrder: String(c.sortOrder),
      isEnabled: c.isEnabled,
      coverImages: Array.isArray(c.config?.coverImages) ? (c.config.coverImages as string[]) : []
    });
    setShowCreate(false);
  };

  const closeModal = () => {
    setEditingId(null);
    setShowCreate(false);
    setDraft(emptyDraft);
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage("");
    try {
      const body = {
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        engine: draft.engine,
        sortOrder: Number(draft.sortOrder) || 0,
        isEnabled: draft.isEnabled,
        config: { coverImages: draft.coverImages }
      };
      if (editingId) {
        await updateCategory(editingId, body);
        setMessage("已更新类目。");
      } else {
        await createCategory(body);
        setMessage("已创建类目。");
      }
      closeModal();
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

  // 上传卡片封面图（两个位置 idx 0/1），上传后把 URL 写进 draft.coverImages
  const handleUploadCover = async (idx: 0 | 1, file: File) => {
    setUploadingIdx(idx);
    setMessage("");
    try {
      const { url } = await uploadCategoryCover(file);
      const next = [...draft.coverImages];
      next[idx] = url;
      setDraft({ ...draft, coverImages: next });
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "上传失败。");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleRemoveCover = (idx: 0 | 1) => {
    const next = draft.coverImages.filter((_, i) => i !== idx);
    setDraft({ ...draft, coverImages: next });
  };

  return (
    <>
      <PageHeader
        title="类目管理"
        subtitle="配置内容类目，新增后首页可见。当前默认「婚纱-小红书」"
        actions={
          <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); setEditingId(null); setDraft(emptyDraft); }}>
            新增类目
          </Button>
        }
      />

      {message && <div className="rounded-md bg-bg px-3 py-2 text-sm text-text-muted ring-1 ring-border">{message}</div>}

      <Modal
        open={showCreate || !!editingId}
        onClose={closeModal}
        title={editingId ? "编辑类目" : "新建类目"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={busy} disabled={!draft.name}>保存</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="类目名称">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="婚纱-小红书" />
          </Field>
          <Field label="内容引擎">
            <select className={inputClass} value={draft.engine} onChange={(e) => setDraft({ ...draft, engine: e.target.value })}>
              {engines.length > 0
                ? engines.map((e) => <option key={e.key} value={e.key}>{e.name}（{e.key}）</option>)
                : <option value="bridal">婚纱礼服内容引擎（bridal）</option>}
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
          <div className="sm:col-span-2">
            <Field label="类目图标（点选预设）">
              <div className="flex flex-wrap items-center gap-2">
                {ICON_PRESETS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: ic })}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xl transition ${draft.icon === ic ? "bg-primary/15 ring-2 ring-primary" : "bg-bg ring-1 ring-border hover:bg-primary/5"}`}
                  >
                    {ic}
                  </button>
                ))}
                {draft.icon && !ICON_PRESETS.includes(draft.icon) && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-xl ring-2 ring-primary">{draft.icon}</span>
                )}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="卡片封面图（上传两张，首页卡片顶部展示）">
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((idx) => {
                  const url = draft.coverImages[idx];
                  const isLoading = uploadingIdx === idx;
                  return (
                    <div key={idx} className="relative aspect-[3/4] overflow-hidden rounded-md bg-bg ring-1 ring-border">
                      {url ? (
                        <>
                          <img src={url} alt={`封面 ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveCover(idx as 0 | 1)}
                            className="absolute right-1 top-1 rounded-full bg-text/70 p-1 text-xs text-white hover:bg-text"
                            aria-label="删除封面"
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                          </button>
                        </>
                      ) : (
                        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs text-text-muted hover:bg-primary/5">
                          {isLoading ? (
                            <span>上传中...</span>
                          ) : (
                            <>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                              <span>上传图片 {idx + 1}</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isLoading}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUploadCover(idx as 0 | 1, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="类目简介">
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="一句话描述该类目的用途，将展示在首页卡片。" rows={3} />
            </Field>
          </div>
        </div>
      </Modal>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                {["类目", "简介", "引擎", "排序", "状态", "操作"].map((h) => (
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
                  <td className="max-w-[320px] px-4 py-3 text-text-muted">
                    <span className="line-clamp-2">{c.description || "-"}</span>
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
                <tr><td colSpan={6} className="py-8 text-center text-sm text-text-muted">暂无类目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
