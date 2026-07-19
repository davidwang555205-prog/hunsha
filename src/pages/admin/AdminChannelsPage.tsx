/**
 * AdminChannelsPage -- 模型线路管理（V2，苹果风格）
 *
 * 路由 /admin/channels。CRUD 模型线路：
 * - 列表（名称/协议/模型/状态/统计：调用次数/成功率/平均耗时）
 * - 创建/编辑（弹窗：名称/协议/API Base/API Key/模型 ID/支持尺寸/默认质量/启用/默认/排序）
 * - 删除（默认线路不可删）
 * - Redfox 跨平台数据服务 Key（独立于生图线路，管理员可在此更新）
 */
import { useEffect, useState } from "react";
import { listChannels, createChannel, updateChannel, deleteChannel, listSettings, updateSetting } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { Channel } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { inputClass } from "../../studio/constants";

type ChannelDraft = {
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  protocol: string;
  modelId: string;
  supportedSizes: string;
  defaultQuality: string;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: string;
  maxConcurrency: string;
  requestTimeoutSeconds: string;
};

const emptyDraft: ChannelDraft = {
  name: "",
  apiBaseUrl: "",
  apiKey: "",
  protocol: "openai",
  modelId: "gpt-image-2",
  supportedSizes: "1152x1536,1024x1024",
  defaultQuality: "medium",
  isEnabled: true,
  isDefault: false,
  sortOrder: "0",
  maxConcurrency: "1",
  requestTimeoutSeconds: "0"
};

const protocolOptions = [
  { value: "openai", label: "OpenAI 兼容（官方 / WalaAPI）" },
  { value: "openrouter", label: "OpenRouter（/images + input_references）" }
];

export function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [redfoxKey, setRedfoxKey] = useState("");
  const [redfoxConfigured, setRedfoxConfigured] = useState(false);
  const [redfoxMaskedKey, setRedfoxMaskedKey] = useState("");
  const [savingRedfox, setSavingRedfox] = useState(false);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const payload = await listChannels();
      setChannels(payload.channels);
      try {
        const settings = await listSettings();
        const redfox = settings.settings.find((setting) => setting.key === "redfox_api");
        setRedfoxConfigured(redfox?.value.configured === true);
        setRedfoxMaskedKey(typeof redfox?.value.maskedKey === "string" ? redfox.value.maskedKey : "");
      } catch {
        // Redfox 状态读取失败不影响已有模型线路的管理。
        setRedfoxConfigured(false);
        setRedfoxMaskedKey("");
      }
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRedfox = async () => {
    const apiKey = redfoxKey.trim();
    if (!apiKey) {
      setMessage("请填写 Redfox API Key。");
      return;
    }
    setSavingRedfox(true);
    setMessage("");
    try {
      const response = await updateSetting("redfox_api", { value: { apiKey } });
      setRedfoxConfigured(response.setting.value.configured === true);
      setRedfoxMaskedKey(typeof response.setting.value.maskedKey === "string" ? response.setting.value.maskedKey : "");
      setRedfoxKey("");
      setMessage("Redfox 数据服务 Key 已更新，后续采集将自动使用新凭证。");
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "Redfox Key 保存失败。");
    } finally {
      setSavingRedfox(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchChannels();
  }, []);

  const startEdit = (ch: Channel) => {
    setEditingId(ch.id);
    setDraft({
      name: ch.name,
      apiBaseUrl: ch.apiBaseUrl,
      apiKey: ch.apiKey ?? "",
      protocol: ch.protocol || "openai",
      modelId: ch.modelId,
      supportedSizes: ch.supportedSizes.join(","),
      defaultQuality: ch.defaultQuality,
      isEnabled: ch.isEnabled,
      isDefault: ch.isDefault,
      sortOrder: String(ch.sortOrder),
      maxConcurrency: String(ch.maxConcurrency ?? 1),
      requestTimeoutSeconds: ch.requestTimeoutMs > 0 ? String(ch.requestTimeoutMs / 1000) : "0"
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
        apiBaseUrl: draft.apiBaseUrl,
        apiKey: draft.apiKey,
        protocol: draft.protocol,
        modelId: draft.modelId,
        supportedSizes: draft.supportedSizes.split(",").map((s) => s.trim()).filter(Boolean),
        defaultQuality: draft.defaultQuality,
        isEnabled: draft.isEnabled,
        isDefault: draft.isDefault,
        sortOrder: Number(draft.sortOrder) || 0,
        maxConcurrency: Number(draft.maxConcurrency) || 1,
        requestTimeoutMs: Math.round((Number(draft.requestTimeoutSeconds) || 0) * 1000)
      };
      if (editingId) {
        await updateChannel(editingId, body);
        setMessage("已更新线路。");
      } else {
        await createChannel(body);
        setMessage("已创建线路。");
      }
      closeModal();
      await fetchChannels();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除该线路？")) return;
    setBusy(true);
    try {
      await deleteChannel(id);
      setMessage("已删除线路。");
      await fetchChannels();
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="模型线路"
        subtitle="配置 AI 生图模型线路，支持多协议与多线路统计"
      />

      {message && <div className="rounded-md bg-bg px-3 py-2 text-sm text-text-muted ring-1 ring-border">{message}</div>}

      <Modal
        open={showCreate || !!editingId}
        onClose={closeModal}
        title={editingId ? "编辑线路" : "新建线路"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={busy} disabled={!draft.name || !draft.apiBaseUrl || !draft.modelId}>
              保存
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="名称">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="WalaAPI GPT Image-2" />
          </Field>
          <Field label="调用协议">
            <select className={inputClass} value={draft.protocol} onChange={(e) => setDraft({ ...draft, protocol: e.target.value })}>
              {protocolOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="API Base URL">
            <Input value={draft.apiBaseUrl} onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })} />
          </Field>
          <Field label="API Key">
            <Input type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder={editingId ? "留空不改" : "sk-..."} />
          </Field>
          <Field label="模型 ID">
            <Input value={draft.modelId} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} />
          </Field>
          <Field label="支持尺寸（逗号分隔）">
            <Input value={draft.supportedSizes} onChange={(e) => setDraft({ ...draft, supportedSizes: e.target.value })} />
          </Field>
          <Field label="默认质量">
            <select className={inputClass} value={draft.defaultQuality} onChange={(e) => setDraft({ ...draft, defaultQuality: e.target.value })}>
              {["low", "medium", "high", "auto"].map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="排序">
            <Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
          </Field>
          <Field label="最大并发">
            <Input type="number" value={draft.maxConcurrency} onChange={(e) => setDraft({ ...draft, maxConcurrency: e.target.value })} />
            <span className="mt-1 block text-xs text-text-muted">1=逐张串行生成，2=最多 2 张并发（建议 1-5）</span>
          </Field>
          <Field label="单次请求超时（秒）">
            <Input type="number" min="0" max="600" value={draft.requestTimeoutSeconds} onChange={(e) => setDraft({ ...draft, requestTimeoutSeconds: e.target.value })} />
            <span className="mt-1 block text-xs text-text-muted">0=继承系统兼容值；建议 OpenRouter 240 秒、WalaAPI 420 秒</span>
          </Field>
          <Field label="启用">
            <label className="flex items-center gap-2 pt-2.5">
              <input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} />
              <span className="text-sm text-text">{draft.isEnabled ? "启用" : "禁用"}</span>
            </label>
          </Field>
          <Field label="设为默认">
            <label className="flex items-center gap-2 pt-2.5">
              <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
              <span className="text-sm text-text">{draft.isDefault ? "默认线路" : "非默认"}</span>
            </label>
          </Field>
        </div>
      </Modal>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              数据服务凭证
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-text">Redfox 跨平台数据服务</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">一份 Key，多平台复用</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
              同一份 API Key 可用于 Redfox 支持的多个内容平台。当前系统已接入小红书的笔记、账号与相似账号采集；后续扩展其他平台时无需重复配置。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-muted">
              {['内容数据采集', '账号数据分析', '多平台持续扩展'].map((item) => (
                <span key={item} className="rounded-md bg-bg px-2.5 py-1.5 ring-1 ring-border">{item}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-bg/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">服务 Key</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">仅服务端加密保存，不会回显原文。</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${redfoxConfigured ? "bg-success/10 text-success" : "bg-surface text-text-muted ring-1 ring-border"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${redfoxConfigured ? "bg-success" : "bg-text-subtle"}`} />
                {redfoxConfigured ? "已配置" : "未配置"}
              </span>
            </div>
            {redfoxConfigured && redfoxMaskedKey && <p className="mt-4 text-xs text-text-subtle">当前凭证：{redfoxMaskedKey}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="new-password"
                value={redfoxKey}
                onChange={(e) => setRedfoxKey(e.target.value)}
                placeholder={redfoxConfigured ? "粘贴新 Key 以更新" : "粘贴 Redfox API Key"}
              />
              <Button className="shrink-0" variant="primary" size="sm" onClick={handleSaveRedfox} loading={savingRedfox}>
                {redfoxConfigured ? "更新 Key" : "保存 Key"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">生图模型线路</h2>
            <p className="mt-1 text-xs text-text-muted">管理用于图片生成的模型、协议与调用参数。</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); setEditingId(null); setDraft(emptyDraft); }}>
            新增线路
          </Button>
        </div>
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr>
                {["名称", "协议", "模型", "并发", "超时", "状态", "调用次数", "成功率", "平均耗时", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-3 px-4 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{ch.name}{ch.isDefault && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}</div>
                    <div className="text-xs text-text-muted">{ch.apiBaseUrl}</div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{ch.protocol || "openai"}</td>
                  <td className="px-4 py-3 text-text">{ch.modelId}</td>
                  <td className="px-4 py-3 text-text-muted">{ch.maxConcurrency}</td>
                  <td className="px-4 py-3 text-text-muted">{ch.requestTimeoutMs > 0 ? `${Math.round(ch.requestTimeoutMs / 1000)}s` : "继承"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ch.isEnabled ? "bg-success/10 text-success" : "bg-bg text-text-muted"}`}>
                      {ch.isEnabled ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">{ch.stats?.totalRequests ?? 0}</td>
                  <td className="px-4 py-3 text-text">{ch.stats?.successRate != null ? `${ch.stats.successRate}%` : "-"}</td>
                  <td className="px-4 py-3 text-text">{ch.stats?.avgLatencyMs ? `${Math.round(ch.stats.avgLatencyMs / 1000)}s` : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(ch)}>编辑</Button>
                      {!ch.isDefault && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(ch.id)} loading={busy}>删除</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && !isLoading && (
                <tr><td colSpan={10} className="py-8 text-center text-sm text-text-muted">暂无线路，请新增</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
