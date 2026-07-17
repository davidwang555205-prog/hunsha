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
  createEngine,
  updateEngine,
  deleteEngine,
  getDefaultAssets
} from "../../api/admin";
import { getPromptOptions } from "../../api/engines";
import { isUnauthorizedError } from "../../types/api";
import type { ContentEngine, DefaultAssets } from "../../types/api";
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

export function AdminEnginesPage() {
  const [engines, setEngines] = useState<ContentEngine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EngineDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [seedingJson, setSeedingJson] = useState<string>("{}");
  const [imagePromptJson, setImagePromptJson] = useState<string>("{}");

  const fetchEngines = async () => {
    setIsLoading(true);
    try {
      const payload = await listAllEngines();
      setEngines(payload.engines);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEngines();
  }, []);

  // 拉默认素材 + 引擎 config，初始化两个 JSON 编辑框（均显示当前生效值）
  // - seeding：deepMerge(代码默认, config.seeding) 深度合并生效值
  // - imagePrompt：getPromptOptions 返回的 MergeAssets 合并生效值（config 为空即代码默认 16 项）
  const initFormAssets = async (key: string, config: Record<string, unknown> | undefined) => {
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

  const startEdit = (e: ContentEngine) => {
    setEditingId(e.id);
    setDraft({
      key: e.key,
      name: e.name,
      description: e.description ?? "",
      sortOrder: String(e.sortOrder),
      isEnabled: e.isEnabled
    });
    setShowCreate(false);
    void initFormAssets(e.key, e.config);
  };

  const openCreate = () => {
    setShowCreate(true);
    setEditingId(null);
    setDraft(emptyDraft);
    void initFormAssets("bridal", undefined);
  };

  const closeModal = () => {
    setEditingId(null);
    setShowCreate(false);
    setDraft(emptyDraft);
    setSeedingJson("{}");
    setImagePromptJson("{}");
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
    const config: Record<string, unknown> = { seeding, imagePrompt };
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
        await updateEngine(editingId, body);
        setMessage("已更新引擎。");
      } else {
        await createEngine(body);
        setMessage("已创建引擎。");
      }
      closeModal();
      await fetchEngines();
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
      setMessage("已删除引擎。");
      await fetchEngines();
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
            <Field label="内容引擎素材（config.seeding，主题与内容；bridalTopics / dressTopics 决定工作台主题）">
              <JsonEditorField
                value={seedingJson}
                onChange={setSeedingJson}
                onUpload={makeUploadHandler(setSeedingJson)}
                onExport={makeExportHandler(seedingJson, "seeding.json")}
                rows={20}
              />
            </Field>
            <PromptHelpBox title="给大模型的说明（展开查看 · 复制后粘贴给 AI 生成/修改此 JSON）" description={SEEDING_PROMPT_HELP} />
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
            <PromptHelpBox title="给大模型的说明（展开查看 · 复制后粘贴给 AI 生成/修改此 JSON）" description={IMAGE_PROMPT_HELP} />
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
              {engines.map((e) => (
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

// 给大模型的说明：内容引擎素材（config.seeding，深度合并语义）
const SEEDING_PROMPT_HELP = `你是「内容引擎素材 JSON」编辑助手。用户会给你当前 config.seeding 的 JSON，要你修改或新增字段。这个 JSON 是内容引擎的素材银行（标题池/变体银行/主题覆盖/场景映射等），运行时与代码默认素材「深度合并」后用于确定性生成文案（非 LLM）。以下字段结构是此 JSON 的权威定义，字段名固定不可改（改了后端解析失败）。与具体场景无关，后续会扩展更多场景，新增场景即新增 map 的 key。

## 职责边界（先判断用户要改什么）
- 本 JSON 负责用户在工作台看到的主题、主题顺序、标题/正文/标签、主题场景和配图蓝图。
- 生图提示词 JSON 只负责把图片类型、场景、模特、关键词档案等参数翻译成英文 prompt；不要在生图提示词 JSON 中维护主题。
- 新增主题、主题改名或主题删除时，必须改本 JSON 的 bridalTopics / dressTopics；只改某个素材 map 的 key 不会让主题出现在工作台。
- 为主题新增配图蓝图时，imageType、scenePreference、keywordProfileId 必须与生图提示词 JSON 中的 key 一致；缺失时会走后端默认值，不能假设会自动新增英文 prompt。

## 合并语义（最重要，决定你怎么改）
- 对象（map）：递归合并--你给出的 key 会并入默认，同 key 的值再递归合并。改某主题的某素材组，只给该 key 即可，其余保留默认。
- 数组（[]string）：整体替换--配了某个数组就整个换掉默认数组，不是追加。要加一条必须把完整新数组给全。
- 标量（string）：整体覆盖。
- 不改的字段省略（省略 = 用默认）。

## 顶层字段结构（共 19 个，字段名固定）
- bridalVariationBank / dressVariationBank：婚纱/裙装品类默认变体银行（CopyVariationBank）
- xiaohongshuTopicOverrides：主题覆盖（map[主题名]CopyVariationBank），主题名以用户 JSON 里的实际 key 为准
- topicCopyKits：主题素材包（map[主题名]TopicCopyKit）
- xiaohongshuBridalCopyDrafts：文案草稿（map[主题名][]XhsCopyDraft）
- titleStarters / titleAngles / titleClosers：标题开头/角度/收尾池（[]string，按 variantIndex 确定性拼接成标题）
- bridalVisualRecipes / dressVisualRecipes：视觉配方（VisualRecipes）
- englishVisualAlignmentByTopic：主题英文对齐（map[string]string）
- personImageTypes：人物图片类型（[]string）
- bridalMainSceneByTopic / dressMainSceneByTopic：主题主场景映射（map[string]string）
- bridalTopics / dressTopics：对应品类的主题列表（[]string），是工作台主题唯一来源；数组顺序即展示顺序，可新增、改名、删除主题。
- xiaohongshuBridalContentProfiles：内容档案（map[主题名]XhsContentProfile）
- bridalScenesByImageType / dressScenesByImageType：场景按图片类型映射（map[图片类型][]string）

## 嵌套结构
- CopyVariationBank { audiences, focuses, concerns, proofs, scenes, materials, services, takeaways, tones, tagExtras }  全是 []string
- TopicCopyKit { titles, openings, observations, scenes, closings, tags []string; note string }
- VisualRecipes { cameras, evidence, details []string }
- XhsCopyDraft { titles, paragraphs, tags []string; note string }
- XhsContentProfile { topic, intent, sourcePattern string; copyKit TopicCopyKit; imageBlueprints []XhsImageBlueprint }
- XhsImageBlueprint { name, purpose, description, imageType, scenePreference, keywordProfileId, extraRequirement string }

## 关键规则
- 字段名与嵌套结构必须与上面定义完全一致，改字段名或结构会导致后端解析失败。
- 主题由 bridalTopics / dressTopics 定义，不再受前后端枚举限制。新增、改名、删除主题时，先改对应数组，再同步修改 topicCopyKits、xiaohongshuTopicOverrides、*MainSceneByTopic、englishVisualAlignmentByTopic 等以主题名为 key 的内容素材。
- 主题数组不能写空，主题名不能有首尾空格或重复项。主题没有专属素材时仍会使用品类默认变体银行和通用配图模板。
- 非主题的图片类型/场景 map 可按既有结构补充 key，但必须同时补齐其引用关系。

## 主题操作清单
- 新增主题：在 bridalTopics 或 dressTopics 追加主题名；至少补 topicCopyKits 的标题、开场、观察、场景、收尾和标签，建议同步补 *MainSceneByTopic。
- 主题改名：替换主题数组中的旧名，并同步替换所有以旧名为 key 的素材 map key；不要只改 map key 或只改数组。
- 删除主题：从主题数组删除；遗留的同名素材 key 不会被工作台或生成流程使用，可保留以便回滚。
- 只改内容：主题数组不动，只修改对应主题 key 下的素材 value。

## 输出要求
- 只输出完整的 config.seeding JSON 对象（或用户要改的字段片段），必须合法 JSON。
- 不要 markdown 代码围栏，不要解释文字。
- 中文值保持中文，不要翻译。
- 改哪个字段就给哪个字段完整内容（数组给全、对象给全要改的 key）。`;

// 给大模型的说明：生图提示词素材（config.imagePrompt，字段级整体替换语义）
const IMAGE_PROMPT_HELP = `你是「生图提示词素材 JSON」编辑助手。用户会给你当前 config.imagePrompt 的 JSON，要你修改或新增字段。这个 JSON 是生图 prompt 的素材源（场景/模特/季节/光线的英文 prompt 行、关键词档案、负面约束等），运行时与代码默认「字段级整体替换」后拼进生图 prompt。以下字段结构是此 JSON 的权威定义，字段名固定不可改（改了后端解析失败）。与具体场景无关，后续会扩展更多场景，新增场景即新增 map 的 key。

## 职责边界（先判断用户要改什么）
- 本 JSON 只负责最终英文生图 prompt：把内容引擎输出的图片类型、场景、模特、季节、光线和关键词档案映射为英文描述与负面约束。
- 用户在工作台看到的主题、主题顺序、标题正文标签属于内容引擎素材 JSON；这里绝不新增、改名或删除主题。
- 内容引擎为主题新增 imageType、scenePreference 或 keywordProfileId 时，才在本 JSON 增加同名 key 的英文映射。两个 JSON 的关联只通过这些参数值，不通过主题名称。

## 合并语义（最重要，决定你怎么改）
- 字段级整体替换：每个顶层字段独立判断。你给了某个字段（非空），就整个替换该字段的代码默认值；省略或空则用默认。
- 不是递归合并，不是追加。例如 sceneLines 你只给 1 个 key，则整个 sceneLines 被替换成只有这 1 个 key（其余场景默认全部丢失）。要保留其他场景必须给完整 map。
- 数组同理：negativeRules 给 1 条就只剩这 1 条。要加必须给完整新数组。
- 不改的字段省略（省略 = 用默认），这是安全做法。

## 顶层字段结构（共 16 个，字段名固定）
- materialImageTypes / wornImageTypes：材质图/上身图类型（[]string）
- categoryLines：品类 prompt 行（map[string]string）
- bridalStyleLines / dressStyleLines：婚纱/裙装款式 prompt 行（map[string]string）
- imageTypeLines：图片类型 prompt 行（map[string]string）
- sceneLines：场景 prompt 行（map[string]string），key 是场景名，以用户 JSON 里的实际 key 为准
- modelLines：模特 prompt 行（map[string]string）
- seasonLines：季节 prompt 行（map[string]string）
- lightLines：光线 prompt 行（map[string]string）
- bridalImageKeywordProfiles：关键词档案（map[档案id]KeywordProfile），id 以用户 JSON 里的实际 key 为准
- bridalScenesByImageType / dressScenesByImageType：场景按图片类型映射（map[图片类型][]string），图片类型 key 以用户 JSON 里的实际 key 为准
- bridalReferenceDetails / dressReferenceDetails：参考细节（[]string，英文）
- negativeRules：负面约束（[]string，英文）

## 嵌套结构
- KeywordProfile { promptLine string; negativeLine string }  promptLine 正向关键词，negativeLine 负向约束，均英文完整描述

## 值的规范
- *Lines 字段：key 是中文业务标识（场景名/模特名/图片类型等），value 是英文 prompt 片段（拼进生图 prompt）。
- negativeRules / referenceDetails：英文短句。
- 关键词档案的 promptLine/negativeLine：完整英文描述句。

## 关键规则
- 字段名与嵌套结构必须与上面定义完全一致，改字段名或结构会导致后端解析失败。
- map 的 key 是业务标识，value 是素材内容；新增 key 即新增场景，参考用户 JSON 里已有 key 的命名风格，不要改动已有 key 的含义。
- 此 JSON 不负责内容主题。不要在这里改名、新增或删除主题；主题和内容请改 config.seeding 的 bridalTopics / dressTopics 及对应素材 map。

## 输出要求
- 只输出完整的 config.imagePrompt JSON 对象（或用户要改的字段片段），必须合法 JSON。
- 不要 markdown 代码围栏，不要解释文字。
- 改哪个字段给哪个字段完整内容（map 给全要保留的 key，数组给全）。
- 英文 prompt 值保持英文，中文 key 保持中文。`;

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
