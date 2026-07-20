/**
 * AdminSettingsPage -- 系统配置（admin）
 *
 * 路由 /admin/settings。聚合各类系统级配置，每项一个小卡片只显示状态，
 * 点击卡片打开 Modal 弹窗配置详情。目前含：
 * - 短信服务（腾讯云，手机号注册 / 短信重置）
 * - 邮箱服务（SMTP，邮件重置密码 / 邮箱绑定验证）
 * 以后加新配置直接加一个 ConfigCard + Modal。
 *
 * 敏感字段（SecretKey / SMTP 密码）加密存库，页面脱敏回显，留空保存保留原值。
 * 超级管理员直接保存生效，无需二次验证。
 */
import { useEffect, useState } from "react";
import { getSmsSettings, getSmtpSettings, updateSmsSettings, updateSmtpSettings } from "../../api/admin";
import { isUnauthorizedError, type SmsSettings, type SmsSettingsUpdateRequest, type SmtpSettings, type SmtpSettingsUpdateRequest } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";

// ===== 短信配置 =====

const defaultSmsForm: SmsSettingsUpdateRequest = {
  enabled: false,
  secret_id: "",
  secret_key: "",
  app_id: "",
  sign_name: "",
  template_id: "",
  region: "ap-guangzhou",
  code_expire_min: 5,
  send_interval_sec: 60,
  daily_limit: 10
};

const toSmsForm = (s: SmsSettings): SmsSettingsUpdateRequest => ({
  enabled: s.enabled,
  secret_id: s.secret_id,
  secret_key: "",
  app_id: s.app_id,
  sign_name: s.sign_name,
  template_id: s.template_id,
  region: s.region,
  code_expire_min: s.code_expire_min,
  send_interval_sec: s.send_interval_sec,
  daily_limit: s.daily_limit
});

function SmsConfigModal({
  open,
  onClose,
  settings,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  settings: SmsSettings | null;
  onSaved: (s: SmsSettings) => void;
}) {
  const [form, setForm] = useState<SmsSettingsUpdateRequest>(defaultSmsForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(toSmsForm(settings));
      setError("");
    }
  }, [open, settings]);

  const update = <K extends keyof SmsSettingsUpdateRequest,>(key: K, value: SmsSettingsUpdateRequest[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const { sms } = await updateSmsSettings(form);
      onSaved(sms);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="短信服务配置"
      size="lg"
      footer={
        <>
          {error && <span className="mr-auto text-sm text-danger">{error}</span>}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-text">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => update("enabled", e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        启用短信服务
      </label>

      {settings?.configured && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          SecretKey 已配置（{settings.masked_secret_key}），留空保存则保留原值。
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="SecretID" hint="CAM 访问密钥 ID（AKID 开头）">
          <Input value={form.secret_id} onChange={(e) => update("secret_id", e.target.value)} placeholder="AKID..." />
        </Field>
        <Field label="SecretKey" hint={settings?.configured ? `已配置 ${settings.masked_secret_key}，留空=不改` : "CAM 访问密钥 SecretKey"}>
          <Input
            type="password"
            value={form.secret_key ?? ""}
            onChange={(e) => update("secret_key", e.target.value)}
            placeholder={settings?.configured ? "留空保留原值" : "32 位 SecretKey"}
          />
        </Field>
        <Field label="SDKAppID" hint="短信应用 ID">
          <Input value={form.app_id} onChange={(e) => update("app_id", e.target.value)} placeholder="1401162580" />
        </Field>
        <Field label="签名 SignName" hint="短信签名（审核通过的内容）">
          <Input value={form.sign_name} onChange={(e) => update("sign_name", e.target.value)} placeholder="如 黑镜婚纱" />
        </Field>
        <Field label="模板 ID TemplateID" hint="验证码模板 ID">
          <Input value={form.template_id} onChange={(e) => update("template_id", e.target.value)} placeholder="如 1234567" />
        </Field>
        <Field label="Region" hint="地域">
          <Input value={form.region} onChange={(e) => update("region", e.target.value)} placeholder="ap-guangzhou" />
        </Field>
        <Field label="验证码有效期（分钟）" hint="默认 5">
          <Input type="number" value={String(form.code_expire_min)} onChange={(e) => update("code_expire_min", Number(e.target.value) || 0)} />
        </Field>
        <Field label="发送间隔（秒）" hint="同号最小间隔，默认 60">
          <Input type="number" value={String(form.send_interval_sec)} onChange={(e) => update("send_interval_sec", Number(e.target.value) || 0)} />
        </Field>
        <Field label="每日上限（次/号）" hint="同号每日发送上限，默认 10">
          <Input type="number" value={String(form.daily_limit)} onChange={(e) => update("daily_limit", Number(e.target.value) || 0)} />
        </Field>
      </div>

      <details className="mt-5 rounded-md bg-bg p-4 text-sm text-text-muted">
        <summary className="cursor-pointer font-medium text-text">在哪里获取这些资料？</summary>
        <ul className="mt-3 space-y-2 leading-6">
          <li>
            <b>SDKAppID</b>：短信控制台 → 应用管理 → 应用详情（你的应用 blackmirror：<code>1401162580</code>）
          </li>
          <li>
            <b>SecretID / SecretKey</b>：访问管理 CAM → API 密钥管理。建议建子账号关联 <code>QcloudSMSFullAccess</code> 策略，用子账号密钥。
          </li>
          <li>
            <b>签名 SignName</b>：短信控制台 → 国内短信 → 签名管理，创建并审核通过。
          </li>
          <li>
            <b>模板 ID</b>：短信控制台 → 国内短信 → 正文模板管理。正文须含 <code>{`{1}`}</code> 验证码、<code>{`{2}`}</code> 有效期分钟，如：
            <code>您的验证码为{`{1}`}，{`{2}`}分钟内有效，请勿泄露。</code>
          </li>
          <li>
            <b>Region</b>：默认 ap-guangzhou，按短信应用所在地域填写。
          </li>
        </ul>
      </details>
    </Modal>
  );
}

// ===== 邮箱配置 =====

const defaultSmtpForm: SmtpSettingsUpdateRequest = {
  host: "",
  port: "587",
  username: "",
  password: "",
  from: "",
  tls: true
};

const toSmtpForm = (s: SmtpSettings): SmtpSettingsUpdateRequest => ({
  host: s.host,
  port: s.port,
  username: s.username,
  password: "",
  from: s.from,
  tls: s.tls
});

function SmtpConfigModal({
  open,
  onClose,
  settings,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  settings: SmtpSettings | null;
  onSaved: (s: SmtpSettings) => void;
}) {
  const [form, setForm] = useState<SmtpSettingsUpdateRequest>(defaultSmtpForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(toSmtpForm(settings));
      setError("");
    }
  }, [open, settings]);

  const update = <K extends keyof SmtpSettingsUpdateRequest,>(key: K, value: SmtpSettingsUpdateRequest[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const { smtp } = await updateSmtpSettings(form);
      onSaved(smtp);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="邮箱服务配置"
      size="lg"
      footer={
        <>
          {error && <span className="mr-auto text-sm text-danger">{error}</span>}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      {settings?.configured && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          密码已配置（{settings.masked_password}），留空保存则保留原值。
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="SMTP 主机" hint="如 smtp.qq.com / smtp.gmail.com">
          <Input value={form.host} onChange={(e) => update("host", e.target.value)} placeholder="smtp.qq.com" />
        </Field>
        <Field label="端口" hint="SSL 通常 465，TLS/STARTTLS 587">
          <Input value={form.port} onChange={(e) => update("port", e.target.value)} placeholder="587" />
        </Field>
        <Field label="用户名" hint="通常为发件邮箱地址">
          <Input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="noreply@example.com" />
        </Field>
        <Field label="密码 / 授权码" hint={settings?.configured ? `已配置 ${settings.masked_password}，留空=不改` : "邮箱密码或服务商授权码"}>
          <Input
            type="password"
            value={form.password ?? ""}
            onChange={(e) => update("password", e.target.value)}
            placeholder={settings?.configured ? "留空保留原值" : "密码或授权码"}
          />
        </Field>
        <Field label="发件地址" hint="From 地址，通常同用户名">
          <Input value={form.from} onChange={(e) => update("from", e.target.value)} placeholder="noreply@example.com" />
        </Field>
        <Field label="TLS" hint="启用 TLS（端口 587 勾选，465 用 SSL 也勾选）">
          <label className="flex h-[42px] items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={form.tls} onChange={(e) => update("tls", e.target.checked)} className="h-4 w-4 rounded border-border" />
            启用 TLS
          </label>
        </Field>
      </div>

      <details className="mt-5 rounded-md bg-bg p-4 text-sm text-text-muted">
        <summary className="cursor-pointer font-medium text-text">在哪里获取这些资料？</summary>
        <ul className="mt-3 space-y-2 leading-6">
          <li>
            <b>QQ 邮箱</b>：设置 → 账户 → 开启 SMTP/IMAP 服务，获取授权码（非登录密码）。主机 <code>smtp.qq.com</code>，端口 465/587。
          </li>
          <li>
            <b>网易 163</b>：设置 → POP3/SMTP/IMAP → 开启，获取授权码。主机 <code>smtp.163.com</code>，端口 465/994。
          </li>
          <li>
            <b>Gmail</b>：开启两步验证后生成"应用专用密码"。主机 <code>smtp.gmail.com</code>，端口 587（TLS）或 465（SSL）。
          </li>
          <li>
            <b>阿里云邮件推送 / 腾讯企业邮箱</b>：控制台获取 SMTP 地址与密码。
          </li>
          <li>密码栏填授权码（QQ/163）或应用专用密码（Gmail），不是邮箱登录密码。</li>
        </ul>
      </details>
    </Modal>
  );
}

// ===== 配置卡片 =====

function ConfigCard({
  title,
  desc,
  status,
  statusKind,
  onClick
}: {
  title: string;
  desc: string;
  status: string;
  statusKind: "ok" | "warn" | "muted";
  onClick: () => void;
}) {
  const badgeClass =
    statusKind === "ok"
      ? "bg-primary/10 text-primary ring-primary/20"
      : statusKind === "warn"
        ? "bg-warning/10 text-warning ring-warning/30"
        : "bg-bg text-text-muted ring-border";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:ring-2 hover:ring-primary/20"
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <p className="mt-1 truncate text-sm text-text-muted">{desc}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badgeClass}`}>{status}</span>
        <span className="text-sm font-medium text-primary">配置</span>
      </div>
    </button>
  );
}

// ===== 主页面 =====

export function AdminSettingsPage() {
  const [sms, setSms] = useState<SmsSettings | null>(null);
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([getSmsSettings(), getSmtpSettings()]);
      setSms(s.sms);
      setSmtp(m.smtp);
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        // 忽略其他错误，卡片显示未配置
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const smsStatus = (): { text: string; kind: "ok" | "warn" | "muted" } => {
    if (!sms) return { text: "未加载", kind: "muted" };
    if (!sms.configured) return { text: "未配置", kind: "warn" };
    if (!sms.enabled) return { text: "未启用", kind: "warn" };
    return { text: "已启用", kind: "ok" };
  };

  const smtpStatus = (): { text: string; kind: "ok" | "warn" | "muted" } => {
    if (!smtp) return { text: "未加载", kind: "muted" };
    if (!smtp.configured || !smtp.host) return { text: "未配置", kind: "warn" };
    return { text: "已配置", kind: "ok" };
  };

  const smsS = smsStatus();
  const smtpS = smtpStatus();

  return (
    <>
      <PageHeader title="系统配置" subtitle="聚合管理系统级配置，点击卡片编辑" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ConfigCard
          title="短信服务"
          desc="腾讯云短信，手机号注册与短信重置密码"
          status={loading ? "加载中..." : smsS.text}
          statusKind={loading ? "muted" : smsS.kind}
          onClick={() => setSmsModalOpen(true)}
        />
        <ConfigCard
          title="邮箱服务"
          desc="SMTP，邮件重置密码与邮箱绑定验证"
          status={loading ? "加载中..." : smtpS.text}
          statusKind={loading ? "muted" : smtpS.kind}
          onClick={() => setSmtpModalOpen(true)}
        />
      </div>

      <SmsConfigModal
        open={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        settings={sms}
        onSaved={(s) => setSms(s)}
      />
      <SmtpConfigModal
        open={smtpModalOpen}
        onClose={() => setSmtpModalOpen(false)}
        settings={smtp}
        onSaved={(s) => setSmtp(s)}
      />
    </>
  );
}
