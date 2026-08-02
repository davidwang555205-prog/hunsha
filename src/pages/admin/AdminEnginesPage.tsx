/**
 * AdminEnginesPage -- 内容引擎管理（V2，苹果风格）
 *
 * 路由 /admin/engines。CRUD 内容引擎：
 * - 列表（名称/标识/简介/排序/状态）
 * - 创建/编辑（弹窗：基础信息 + 内容引擎素材 JSON + 生图提示词 JSON）
 *
 * config.seeding 存内容引擎主题和内容素材，运行时 seeding.MergeAssets 深度合并代码默认（map 递归、slice 整体覆盖）。
 * config.imagePrompt 存生图提示词素材，运行时 prompt.MergeAssets 字段级整体替换默认。
 * 两个 JSON 进弹窗即预填当前生效值（默认 + 覆盖合并），保存全量写回 { seeding, imagePrompt }。
 */
import { useEffect, useState, type ChangeEvent } from "react";
import {
  listAllEngines,
  getEngine,
  createEngine,
  updateEngine,
  deleteEngine,
  getDefaultAssets,
  getEnginePromptHelps
} from "../../api/admin";
import { getPromptOptions } from "../../api/engines";
import { isUnauthorizedError } from "../../types/api";
import type { ContentEngine, ContentEngineSummary, DefaultAssets } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Segmented } from "../../components/ui/Segmented";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Modal } from "../../components/ui/Modal";
import { deepMerge } from "../../utils/deepMerge";

type EngineDraft = {
  key: string;
  name: string;
  description: string;
  sortOrder: string;
  isEnabled: boolean;
};

const emptyDraft: EngineDraft = {
  key: "",
  name: "",
  description: "",
  sortOrder: "0",
  isEnabled: true
};

type TabKey = "basic" | "seeding" | "prompt";

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "基础信息" },
  { key: "seeding", label: "内容引擎素材" },
  { key: "prompt", label: "生图提示词" }
];

/** sessionStorage 缓存 key：管理列表 SWR 模式，二次进入秒开（tab 关闭即失效，避免陈旧） */
const ENGINES_CACHE_KEY = "admin-engines-list";

function readEnginesCache(): ContentEngineSummary[] | null {
  try {
    const raw = window.sessionStorage.getItem(ENGINES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { engines?: ContentEngineSummary[] };
    return Array.isArray(parsed.engines) ? parsed.engines : null;
  } catch {
    return null;
  }
}

function writeEnginesCache(engines: ContentEngineSummary[]) {
  try {
    window.sessionStorage.setItem(ENGINES_CACHE_KEY, JSON.stringify({ engines }));
  } catch {
    // 隐私模式写不进去，忽略
  }
}

/** 保存/创建接口返回的是完整 ContentEngine，本地列表存精简行（剥离 config） */
function toSummary(engine: ContentEngine): ContentEngineSummary {
  const { config: _config, ...summary } = engine;
  return summary;
}

export function AdminEnginesPage() {
  // SWR：先渲染 sessionStorage 缓存，再后台 revalidate
  const [engines, setEngines] = useState<ContentEngineSummary[]>(() => readEnginesCache() ?? []);
  const [isLoading, setIsLoading] = useState(() => readEnginesCache() === null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EngineDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [seedingJson, setSeedingJson] = useState<string>("{}");
  const [imagePromptJson, setImagePromptJson] = useState<string>("{}");
  const [useV2, setUseV2] = useState(false);
  const [copyEnabled, setCopyEnabled] = useState(true);
  // 「给大模型的说明」文本：后端生成（策略白名单动态同步），不再前端硬编码
  const [promptHelps, setPromptHelps] = useState<{ seeding: string; imagePrompt: string } | null>(null);

  const fetchEngines = async () => {
    // 有缓存时后台 revalidate，不再切 isLoading 防止闪烁
    if (engines.length === 0) setIsLoading(true);
    try {
      const payload = await listAllEngines();
      setEngines(payload.engines);
      writeEnginesCache(payload.engines);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEngines();
    getEnginePromptHelps()
      .then(setPromptHelps)
      .catch(() => {
        // 说明文本拉取失败不阻塞主流程，仅不展示说明盒
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拉默认素材 + 引擎 config，初始化两个 JSON 编辑框（均显示当前生效值）
  // - seeding：deepMerge(代码默认, config.seeding) 深度合并生效值
  // - imagePrompt：getPromptOptions 返回的 MergeAssets 合并生效值（config 为空即代码默认 16 项）
  const initFormAssets = async (key: string, config: Record<string, unknown> | undefined) => {
    const v2 = config?.engineV2 as { capabilities?: { copyEnabled?: boolean }; artifacts?: { visualPlan?: unknown; imagePrompt?: unknown } } | undefined;
    if (v2?.artifacts?.visualPlan && v2.artifacts.imagePrompt) {
      setUseV2(true);
      setCopyEnabled(v2.capabilities?.copyEnabled ?? true);
      setSeedingJson(JSON.stringify(v2.artifacts.visualPlan, null, 2));
      setImagePromptJson(JSON.stringify(v2.artifacts.imagePrompt, null, 2));
      setActiveTab("basic");
      return;
    }
    setUseV2(false);
    setCopyEnabled(true);
    const [assets, promptAssets] = await Promise.all([
      getDefaultAssets()
        .then((r) => r.assets)
        .catch(() => null),
      getPromptOptions(key || "bridal")
        .then((r) => r.assets)
        .catch(() => null)
    ]);
    const seeding = (config?.seeding as Record<string, unknown> | undefined) ?? {};
    const merged = assets ? deepMerge(assets, seeding) : (seeding as unknown as DefaultAssets);
    setSeedingJson(JSON.stringify(merged, null, 2));
    setImagePromptJson(JSON.stringify(promptAssets ?? {}, null, 2));
    setActiveTab("basic");
  };

  const startEdit = (e: ContentEngineSummary) => {
    setEditingId(e.id);
    setDraft({
      key: e.key,
      name: e.name,
      description: e.description ?? "",
      sortOrder: String(e.sortOrder),
      isEnabled: e.isEnabled
    });
    setShowCreate(false);
    // 列表行无 config（精简响应），编辑弹窗需单独拉完整引擎回填
    void (async () => {
      try {
        const { engine } = await getEngine(e.id);
        await initFormAssets(engine.key, engine.config);
      } catch (err) {
        if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载引擎详情失败。");
      }
    })();
  };

  const openCreate = () => {
    setShowCreate(true);
    setEditingId(null);
    setDraft(emptyDraft);
    setUseV2(true);
    setCopyEnabled(false);
    setSeedingJson("{}");
    setImagePromptJson("{}");
    setActiveTab("basic");
  };

  const closeModal = () => {
    setEditingId(null);
    setShowCreate(false);
    setDraft(emptyDraft);
    setSeedingJson("{}");
    setImagePromptJson("{}");
    setUseV2(false);
    setCopyEnabled(true);
  };

  const handleSave = async () => {
    let seeding: Record<string, unknown>;
    try {
      seeding = JSON.parse(seedingJson || "{}");
    } catch {
      setMessage("内容引擎素材 JSON 格式不正确，请检查。");
      setActiveTab("seeding");
      return;
    }
    let imagePrompt: Record<string, unknown>;
    try {
      imagePrompt = JSON.parse(imagePromptJson || "{}");
    } catch {
      setMessage("生图提示词 JSON 格式不正确，请检查。");
      setActiveTab("prompt");
      return;
    }
    const config: Record<string, unknown> = useV2
      ? { engineV2: { apiVersion: "content-engine/v2", capabilities: { copyEnabled }, artifacts: { visualPlan: seeding, imagePrompt } } }
      : { seeding, imagePrompt };
    setBusy(true);
    setMessage("");
    try {
      const body = {
        key: draft.key,
        name: draft.name,
        description: draft.description,
        config,
        sortOrder: Number(draft.sortOrder) || 0,
        isEnabled: draft.isEnabled
      };
      if (editingId) {
        const { engine } = await updateEngine(editingId, body);
        // 本地更新：用接口返回的最新 row 替换，不再整表重拉
        setEngines((prev) => {
          const next = prev.map((row) => (row.id === engine.id ? toSummary(engine) : row));
          writeEnginesCache(next);
          return next;
        });
        setMessage("已更新引擎。");
      } else {
        const { engine } = await createEngine(body);
        setEngines((prev) => {
          const next = [...prev, toSummary(engine)];
          writeEnginesCache(next);
          return next;
        });
        setMessage("已创建引擎。");
      }
      closeModal();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除该内容引擎？关联类目需重新指定。")) return;
    setBusy(true);
    try {
      await deleteEngine(id);
      setEngines((prev) => {
        const next = prev.filter((row) => row.id !== id);
        writeEnginesCache(next);
        return next;
      });
      setMessage("已删除引擎。");
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  };

  // JSON 编辑框通用：上传文件载入（校验合法后填充，保存才生效）
  const makeUploadHandler = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      try {
        JSON.parse(text);
        setter(text);
        setMessage("已载入上传的 JSON，保存后生效。");
      } catch {
        setMessage("上传文件不是合法 JSON，已忽略。");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // JSON 编辑框通用：导出当前编辑框内容为 JSON 文件（下载 - 本地编辑 - 上传工作流）
  const makeExportHandler = (value: string, filename: string) => () => {
    const blob = new Blob([value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="内容引擎"
        subtitle="配置内容引擎与可编辑素材（内容引擎素材 / 生图提示词）"
        actions={<Button variant="primary" size="sm" onClick={openCreate}>新增引擎</Button>}
      />

      {message && <div className="rounded-md bg-bg px-3 py-2 text-sm text-text-muted ring-1 ring-border">{message}</div>}

      <Modal
        open={showCreate || !!editingId}
        onClose={closeModal}
        title={editingId ? "编辑引擎" : "新建引擎"}
        size="xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={busy} disabled={!draft.key || !draft.name}>保存</Button>
          </>
        }
      >
        {/* Tab 导航 */}
        <div className="mb-4">
          <Segmented
            options={TAB_LABELS.map(({ key, label }) => ({ value: key, label }))}
            value={activeTab}
            onChange={(v) => setActiveTab(v)}
            size="sm"
          />
        </div>

        {/* 基础信息 */}
        {activeTab === "basic" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="引擎标识（key）">
              <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="bridal" disabled={!!editingId} />
            </Field>
            <Field label="引擎名称">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="婚纱礼服内容引擎" />
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
            <Field label="引擎模式">
              <label className="flex items-center gap-2 pt-2.5">
                <input type="checkbox" checked={useV2} onChange={(e) => setUseV2(e.target.checked)} disabled={!!editingId && !useV2} />
                <span className="text-sm text-text">{useV2 ? "V2 文件包引擎" : "旧版兼容引擎"}</span>
              </label>
            </Field>
            {useV2 && <Field label="内容产出模式">
              <div className="flex flex-col gap-2 pt-1.5">
                <label className="flex items-center gap-2">
                  <input type="radio" name="engine-copy-mode" checked={copyEnabled} onChange={() => setCopyEnabled(true)} />
                  <span className="text-sm text-text">生成图文内容（图片 + 标题、正文、标签）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="engine-copy-mode" checked={!copyEnabled} onChange={() => setCopyEnabled(false)} />
                  <span className="text-sm text-text">仅生成图片</span>
                </label>
              </div>
            </Field>}
            <div className="sm:col-span-2">
              <Field label="引擎简介">
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="一句话描述引擎用途" />
              </Field>
            </div>
          </div>
        )}

        {/* 内容引擎素材（config.seeding，深度合并） */}
        {activeTab === "seeding" && (
          <div className="space-y-3">
            <Field label={useV2 ? "内容引擎素材（V2 visualPlan，主题/文案/图片蓝图）" : "内容引擎素材（config.seeding，主题与内容；bridalTopics / dressTopics 决定工作台主题）"}>
              <JsonEditorField
                value={seedingJson}
                onChange={setSeedingJson}
                onUpload={makeUploadHandler(setSeedingJson)}
                onExport={makeExportHandler(seedingJson, "seeding.json")}
                rows={20}
              />
            </Field>
            {promptHelps && <PromptHelpBox title="给大模型的说明（展开查看 · 复制后粘贴给 AI 生成/修改此 JSON）" description={promptHelps.seeding} />}
          </div>
        )}

        {/* 生图提示词（config.imagePrompt，字段级整体替换） */}
        {activeTab === "prompt" && (
          <div className="space-y-3">
            <Field label="生图提示词（config.imagePrompt，字段级整体替换：配某字段则整体替换默认，未配降级默认）">
              <JsonEditorField
                value={imagePromptJson}
                onChange={setImagePromptJson}
                onUpload={makeUploadHandler(setImagePromptJson)}
                onExport={makeExportHandler(imagePromptJson, "imagePrompt.json")}
                rows={20}
              />
            </Field>
            {promptHelps && <PromptHelpBox title="给大模型的说明（展开查看 · 复制后粘贴给 AI 生成/修改此 JSON）" description={promptHelps.imagePrompt} />}
          </div>
        )}
      </Modal>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                {["引擎", "标识", "简介", "排序", "状态", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-3 px-4 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && engines.length === 0
                ? // 骨架屏：5 行占位，避免白屏 30s 感知
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-bg" />
                        </td>
                      ))}
                    </tr>
                  ))
                : engines.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-bg">
                      <td className="px-4 py-3 font-medium text-text">{e.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">{e.key}</td>
                      <td className="max-w-[320px] px-4 py-3 text-text-muted">
                        <span className="line-clamp-2">{e.description || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-text">{e.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${e.isEnabled ? "bg-success/10 text-success" : "bg-bg text-text-muted"}`}>
                          {e.isEnabled ? "启用" : "禁用"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => startEdit(e)}>编辑</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)} loading={busy}>删除</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {engines.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-text-muted">暂无内容引擎</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** JSON 编辑框：textarea + 上传 + 导出，两个素材 tab 复用。进弹窗即预填生效值，无需手动加载默认。 */
function JsonEditorField({
  value,
  onChange,
  onUpload,
  onExport,
  rows
}: {
  value: string;
  onChange: (v: string) => void;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-bg">
          上传 JSON
          <input type="file" accept="application/json,.json" className="hidden" onChange={onUpload} />
        </label>
        <Button variant="ghost" size="sm" type="button" onClick={onExport}>导出 JSON</Button>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows ?? 18} className="font-mono text-xs" placeholder="{}" />
    </div>
  );
}

/** 大模型说明折叠盒：展示结构说明 + 复制按钮，方便粘贴给 AI 生成/修改 JSON。 */
function PromptHelpBox({ title, description }: { title: string; description: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 不可用时静默失败，用户可手动选择文本复制
    }
  };
  return (
    <details className="rounded-md border border-border bg-bg">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">{title}</summary>
      <div className="space-y-2 px-3 pb-3">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" type="button" onClick={handleCopy}>
            {copied ? "已复制 ✓" : "复制说明给大模型"}
          </Button>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-surface p-3 font-mono text-xs text-text-muted">{description}</pre>
      </div>
    </details>
  );
}
