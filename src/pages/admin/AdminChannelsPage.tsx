/**
 * AdminChannelsPage -- 模型线路管理（V2，苹果风格）
 *
 * 路由 /admin/channels。CRUD 模型线路：
 * - 列表（名称/协议/模型/状态/统计：调用次数/成功率/平均耗时）
 * - 创建/编辑（弹窗：名称/协议/API Base/API Key/模型 ID/支持尺寸/默认质量/启用/默认/排序）
 * - 删除（默认线路不可删）
 */
import { useEffect, useState } from "react";
import { listChannels, createChannel, updateChannel, deleteChannel, listModelCatalog } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { Channel, ModelSpec } from "../../types/api";
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
  proxyUrl: string;
};

// ProtocolPreset 按协议预填的官方默认配置：新建线路时用户只需填 API Key，其余按协议自动带入可调。
type ProtocolPreset = {
  name: string;
  apiBaseUrl: string;
  modelId: string;
  supportedSizes: string;
  defaultQuality: string;
  requestTimeoutSeconds: string;
};

// protocolOptions 调用协议下拉 + 各协议官方端点/默认模型预填。base_url 末尾不带斜杠，
// 子路径（/images、/images/generations、/v1beta/models/...:generateContent）由 wala/client.go 按协议拼接。
const protocolOptions: { value: string; label: string; preset: ProtocolPreset }[] = [
  {
    value: "openai",
    label: "OpenAI 兼容（官方 / WalaAPI）",
    preset: {
      name: "OpenAI GPT Image-2",
      apiBaseUrl: "https://api.openai.com/v1",
      modelId: "gpt-image-2",
      supportedSizes: "1152x1536,1024x1024",
      defaultQuality: "medium",
      requestTimeoutSeconds: "240"
    }
  },
  {
    value: "openrouter",
    label: "OpenRouter（/images + input_references）",
    preset: {
      name: "OpenRouter GPT Image-2",
      apiBaseUrl: "https://openrouter.ai/api/v1",
      modelId: "gpt-image-2",
      supportedSizes: "1152x1536,1024x1024",
      defaultQuality: "medium",
      requestTimeoutSeconds: "240"
    }
  },
  {
    value: "seedream",
    label: "Seedream（字节方舟 ark /images/generations）",
    preset: {
      name: "Seedream 4.0（豆包）",
      apiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      modelId: "doubao-seedream-4-0-250828",
      supportedSizes: "3:4,1:1,4:3",
      defaultQuality: "medium",
      requestTimeoutSeconds: "180"
    }
  },
  {
    value: "gemini",
    label: "Gemini（Google 官方 generateContent）",
    preset: {
      name: "Banana（Nano Banana）",
      apiBaseUrl: "https://generativelanguage.googleapis.com",
      modelId: "gemini-2.5-flash-image-preview",
      supportedSizes: "3:4,1:1,4:3",
      defaultQuality: "medium",
      requestTimeoutSeconds: "180"
    }
  }
];

const presetFor = (protocol: string): ProtocolPreset =>
  protocolOptions.find((o) => o.value === protocol)?.preset ?? protocolOptions[0].preset;

// apiBaseUrlHint 按协议提示官方端点写法，避免尾斜杠/多余子路径致拼接错（openrouter 双重路径 404 坑）。
const apiBaseUrlHint = (protocol: string): string => {
  switch (protocol) {
    case "openai":
      return "官方填 https://api.openai.com/v1；WalaAPI 填 https://walaapi.net/v1（不带 /images）";
    case "openrouter":
      return "https://openrouter.ai/api/v1（不带 /images，否则双重路径 404）";
    case "seedream":
      return "字节方舟 ark：https://ark.cn-beijing.volces.com/api/v3";
    case "gemini":
      return "https://generativelanguage.googleapis.com（不带 /v1beta，由协议拼接）";
    default:
      return "末尾不带斜杠，子路径由协议自动拼接";
  }
};

const emptyDraft: ChannelDraft = {
  ...presetFor("openai"),
  apiKey: "",
  protocol: "openai",
  isEnabled: true,
  isDefault: false,
  sortOrder: "0",
  maxConcurrency: "1",
  proxyUrl: ""
};

export function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [catalog, setCatalog] = useState<ModelSpec[]>([]);

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

  useEffect(() => {
    listModelCatalog()
      .then((r) => setCatalog(r.models))
      .catch(() => {
        /* catalog 加载失败不阻塞：datalist 空，模型 ID 仍可自由输入 */
      });
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
      requestTimeoutSeconds: ch.requestTimeoutMs > 0 ? String(ch.requestTimeoutMs / 1000) : "0",
      proxyUrl: ch.proxyUrl ?? ""
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
        requestTimeoutMs: Math.round((Number(draft.requestTimeoutSeconds) || 0) * 1000),
        proxyUrl: draft.proxyUrl.trim()
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
        {!editingId && (
          <div className="mb-3 rounded-md bg-bg px-3 py-2 text-xs text-text-muted ring-1 ring-border">
            已按所选协议预填官方默认配置（名称 / 地址 / 模型 / 尺寸 / 超时），通常只需填写 API Key，其余可按需调整。
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="名称">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="WalaAPI GPT Image-2" />
          </Field>
          <Field label="调用协议">
            <select className={inputClass} value={draft.protocol} onChange={(e) => {
              const protocol = e.target.value;
              // 新建态：切协议连带刷新官方端点/默认模型/尺寸/超时；编辑态只换协议，不动已配字段
              setDraft(editingId ? { ...draft, protocol } : { ...draft, ...presetFor(protocol), protocol });
            }}>
              {protocolOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="API Base URL">
            <Input value={draft.apiBaseUrl} onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })} />
            <span className="mt-1 block text-xs text-text-muted">{apiBaseUrlHint(draft.protocol)}</span>
          </Field>
          <Field label="API Key">
            <Input type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder={editingId ? "留空不改" : "sk-..."} />
          </Field>
          <Field label="模型 ID">
            <Input
              list="model-catalog-options"
              value={draft.modelId}
              onChange={(e) => {
                const value = e.target.value;
                const spec = catalog.find((m) => m.id === value);
                if (!spec) {
                  setDraft({ ...draft, modelId: value });
                  return;
                }
                const protocol = spec.defaultProtocol;
                // 新建态：选模型连带刷新协议配套默认值（名称取模型展示名）；编辑态只换 modelId + 协议
                setDraft(
                  editingId
                    ? { ...draft, modelId: value, protocol }
                    : { ...draft, ...presetFor(protocol), protocol, modelId: value, name: spec.name }
                );
              }}
            />
            <datalist id="model-catalog-options">
              {catalog.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </datalist>
            {(() => {
              const spec = catalog.find((m) => m.id === draft.modelId);
              return spec ? <span className="mt-1 block text-xs text-text-muted">{spec.description}</span> : null;
            })()}
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
          <Field label="代理地址（可选）">
            <Input value={draft.proxyUrl} onChange={(e) => setDraft({ ...draft, proxyUrl: e.target.value })} placeholder="http://127.0.0.1:7890" />
            <span className="mt-1 block text-xs text-text-muted">仅该线路生图请求与生成图回源下载走此代理，留空直连</span>
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
                    <div className="font-medium text-text">{ch.name}{ch.isDefault && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}{ch.proxyUrl && <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">代理</span>}</div>
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
