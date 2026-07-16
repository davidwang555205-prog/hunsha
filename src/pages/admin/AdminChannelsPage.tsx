/**
 * AdminChannelsPage -- 模型线路管理（V2，苹果风格）
 *
 * 路由 /admin/channels。CRUD 模型线路：
 * - 列表（名称/协议/模型/状态/统计：调用次数/成功率/平均耗时）
 * - 创建/编辑（弹窗：名称/协议/API Base/API Key/模型 ID/支持尺寸/默认质量/启用/默认/排序）
 * - 删除（默认线路不可删）
 */
import { useEffect, useState } from "react";
import { listChannels, createChannel, updateChannel, deleteChannel } from "../../api/admin";
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
  maxConcurrency: "1"
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

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const payload = await listChannels();
      setChannels(payload.channels);
    } catch (err) {
      if (!isUnauthorizedError(err)) setMessage(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
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
      maxConcurrency: String(ch.maxConcurrency ?? 1)
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
        maxConcurrency: Number(draft.maxConcurrency) || 1
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
        actions={
          <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); setEditingId(null); setDraft(emptyDraft); }}>
            新增线路
          </Button>
        }
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

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr>
                {["名称", "协议", "模型", "并发", "状态", "调用次数", "成功率", "平均耗时", "操作"].map((h) => (
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
                <tr><td colSpan={9} className="py-8 text-center text-sm text-text-muted">暂无线路，请新增</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
