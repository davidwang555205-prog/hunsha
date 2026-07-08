import { useEffect, useMemo, useState } from "react";
import { ReferenceImageUploader } from "./components/ReferenceImageUploader";
import { getCompatibleSceneOptions, isSceneCompatibleWithImageType } from "./data/bridalDressSceneOptions";
import { FASHION_MODEL_OPTIONS } from "./data/fashionModelProfiles";
import type {
  BridalStyle,
  DressStyle,
  ImageType,
  LightPreference,
  ModelChoice,
  ProductCategory,
  PromptParams,
  ScenePreference,
  Season
} from "./types";
import {
  fashionSeedingDailySlotOptions,
  formatFashionSeedingContent,
  generateFashionSeedingContent,
  getDailyFashionSeedingSelection,
  getFashionSeedingTopicOptions,
  type FashionSeedingDailySlot,
  type FashionSeedingTopic
} from "./utils/generateFashionSeedingContent";

type ApiUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
};

type Session = {
  token: string;
  user: ApiUser;
};

type AccountSummary = {
  user: ApiUser;
  requestCount: number;
  successCount: number;
  failedCount: number;
  generatedImageCount: number;
  lastGeneratedAt: string | null;
};

type GeneratedImage = {
  id: string;
  url: string;
  downloadUrl: string;
  source: "local" | "remote";
};

type HistoryRecord = {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
  status: "success" | "failed";
  model: string;
  mode: string;
  title: string;
  body: string;
  tags: string[];
  topic: string;
  images: GeneratedImage[];
  error?: string;
  uploadedImageCount: number;
};

type MeResponse = {
  user: ApiUser;
  accounts?: AccountSummary[];
  summary: {
    requestCount: number;
    successCount: number;
    generatedImageCount: number;
    retentionDays: number;
  };
};

type HistoryResponse = {
  history: HistoryRecord[];
};

type GenerateResponse = {
  record: HistoryRecord;
};

type CreateUserResponse = {
  user: ApiUser;
  accounts: AccountSummary[];
};

type ApiRequestError = Error & {
  statusCode?: number;
};

const productCategoryOptions: ProductCategory[] = ["婚纱 / 礼服", "裙装 / 女装"];
const bridalStyleOptions: BridalStyle[] = [
  "极简缎面婚纱",
  "法式蕾丝婚纱",
  "A-line 婚纱",
  "鱼尾婚纱",
  "公主裙婚纱",
  "轻婚纱",
  "短款婚纱",
  "晚宴礼服",
  "自定义"
];
const dressStyleOptions: DressStyle[] = ["连衣裙", "衬衫裙", "针织裙", "吊带裙", "A字裙", "半裙", "度假长裙", "通勤裙", "自定义"];
const imageTypeOptions: ImageType[] = ["产品上身图", "对镜穿搭图", "生活场景图", "非产品氛围图", "拍摄花絮 / 材质图", "产品静物图"];
const seasonOptions: Season[] = ["春", "夏", "秋", "冬"];
const lightPreferenceOptions: LightPreference[] = ["自动匹配", "清晨自然光", "午后柔光", "傍晚金色光", "室内窗边光", "酒店暖光", "婚礼现场自然光"];
const sizeOptions = ["1024x1024", "1024x1536", "1536x1024"];
const qualityOptions = [
  { value: "medium", label: "M / standard" },
  { value: "low", label: "L / low" },
  { value: "high", label: "H / high" },
  { value: "auto", label: "Auto" }
];
const defaultImageQuality = "medium";
const preferredBridalContentTopic: FashionSeedingTopic = "真实客户试纱";
const sessionStorageKey = "bridal-content-studio-session";

const initialParams: PromptParams = {
  productCategory: "婚纱 / 礼服",
  bridalStyle: "极简缎面婚纱",
  dressStyle: "连衣裙",
  customProductName: "",
  imageType: "产品上身图",
  modelChoice: "亚洲新娘感模特 25–35",
  season: "春",
  scenePreference: "酒店套房晨光",
  lightPreference: "室内窗边光",
  extraRequirement: "",
  generationNonce: 0
};

const initialDailySelection = getDailyFashionSeedingSelection(initialParams.productCategory, new Date(), 1);
const initialContentTopic =
  initialParams.productCategory === "婚纱 / 礼服" ? preferredBridalContentTopic : initialDailySelection.topic;

const inputClass =
  "w-full rounded-lg border border-aura-beige bg-white px-3 py-2.5 text-sm text-aura-charcoal outline-none transition focus:border-aura-clay disabled:cursor-not-allowed disabled:bg-aura-cream disabled:text-aura-muted";
const labelClass = "text-sm font-medium text-aura-charcoal";
const mutedClass = "text-sm leading-6 text-aura-muted";
const panelClass = "rounded-lg bg-aura-porcelain p-5 shadow-aura ring-1 ring-aura-beige/70";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-lg bg-aura-charcoal px-4 py-2.5 text-sm font-medium text-aura-porcelain shadow-sm transition hover:bg-aura-muted disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-aura-charcoal ring-1 ring-aura-beige transition hover:bg-aura-cream disabled:cursor-not-allowed disabled:opacity-60";

function updateField<K extends keyof PromptParams>(params: PromptParams, key: K, value: PromptParams[K]) {
  return { ...params, [key]: value };
}

function getDefaultContentTopic(productCategory: ProductCategory, dailySlot: FashionSeedingDailySlot) {
  if (productCategory === "婚纱 / 礼服") return preferredBridalContentTopic;
  return getDailyFashionSeedingSelection(productCategory, new Date(), dailySlot).topic;
}

function loadStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function contentText(record: Pick<HistoryRecord, "title" | "body" | "tags">) {
  return `${record.title}\n\n${record.body}\n\n${record.tags.join(" ")}`;
}

function isUnauthorizedError(error: unknown): error is ApiRequestError {
  return error instanceof Error && (error as ApiRequestError).statusCode === 401;
}

function App() {
  const [session, setSession] = useState<Session | null>(loadStoredSession);
  const [activeView, setActiveView] = useState<"studio" | "admin">("studio");
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [params, setParams] = useState<PromptParams>(initialParams);
  const [contentTopic, setContentTopic] = useState<FashionSeedingTopic>(initialContentTopic);
  const [dailySlot, setDailySlot] = useState<FashionSeedingDailySlot>(1);
  const [contentNonce, setContentNonce] = useState(0);
  const [imageCount, setImageCount] = useState<3 | 5>(3);
  const [contentMessage, setContentMessage] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState(defaultImageQuality);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [summary, setSummary] = useState<MeResponse["summary"] | null>(null);
  const [latestRecord, setLatestRecord] = useState<HistoryRecord | null>(null);
  const [newAccountUsername, setNewAccountUsername] = useState("");
  const [newAccountDisplayName, setNewAccountDisplayName] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountMessage, setNewAccountMessage] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const sceneOptions = useMemo(
    () => getCompatibleSceneOptions(params.productCategory, params.imageType),
    [params.productCategory, params.imageType]
  );
  const contentTopicOptions = useMemo(() => getFashionSeedingTopicOptions(params.productCategory), [params.productCategory]);
  const contentPreview = useMemo(
    () =>
      generateFashionSeedingContent({
        productCategory: params.productCategory,
        baseParams: params,
        imageCount,
        topic: contentTopic,
        dailySlot,
        contentNonce
      }),
    [contentNonce, contentTopic, dailySlot, imageCount, params]
  );
  const accountUsageTotals = useMemo(
    () =>
      accounts.reduce(
        (totals, account) => ({
          requestCount: totals.requestCount + account.requestCount,
          successCount: totals.successCount + account.successCount,
          failedCount: totals.failedCount + account.failedCount,
          generatedImageCount: totals.generatedImageCount + account.generatedImageCount
        }),
        { requestCount: 0, successCount: 0, failedCount: 0, generatedImageCount: 0 }
      ),
    [accounts]
  );

  async function apiRequest<T>(path: string, options: RequestInit = {}, token = session?.token) {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(payload.error || "请求失败。"), { statusCode: response.status });
    }
    return payload as T;
  }

  async function refreshData(token = session?.token) {
    if (!token) return;
    const [me, historyPayload] = await Promise.all([
      apiRequest<MeResponse>("/api/me", undefined, token),
      apiRequest<HistoryResponse>("/api/history", undefined, token)
    ]);
    setSession((current) => (current ? { ...current, user: me.user } : current));
    setSummary(me.summary);
    setAccounts(me.accounts || []);
    setHistory(historyPayload.history);
  }

  useEffect(() => {
    if (!session) return;
    refreshData(session.token).catch((error) => {
      setSession(null);
      setActiveView("studio");
      setLoginError(error instanceof Error ? error.message : "登录已失效。");
      window.localStorage.removeItem(sessionStorageKey);
    });
  }, [session?.token]);

  useEffect(() => {
    if (session?.user.role !== "admin" && activeView === "admin") {
      setActiveView("studio");
    }
  }, [activeView, session?.user.role]);

  const handleLogin = async () => {
    setLoginError("");
    try {
      const payload = await apiRequest<{ token: string; user: ApiUser; accounts?: AccountSummary[] }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const nextSession = { token: payload.token, user: payload.user };
      setSession(nextSession);
      setAccounts(payload.accounts || []);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
      setLoginPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败。");
    }
  };

  const handleLogout = () => {
    setSession(null);
    setActiveView("studio");
    setHistory([]);
    setAccounts([]);
    setSummary(null);
    setLatestRecord(null);
    setNewAccountUsername("");
    setNewAccountDisplayName("");
    setNewAccountPassword("");
    setNewAccountMessage("");
    window.localStorage.removeItem(sessionStorageKey);
  };

  const handleCreateAccount = async () => {
    if (!session || session.user.role !== "admin") return;
    setNewAccountMessage("");
    setIsCreatingAccount(true);

    try {
      const payload = await apiRequest<CreateUserResponse>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: newAccountUsername,
          displayName: newAccountDisplayName,
          password: newAccountPassword
        })
      });
      setAccounts(payload.accounts || []);
      setNewAccountUsername("");
      setNewAccountDisplayName("");
      setNewAccountPassword("");
      setNewAccountMessage(`已开通账号：${payload.user.username}`);
      await refreshData();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleLogout();
        setLoginError(error.message);
        return;
      }
      setNewAccountMessage(error instanceof Error ? error.message : "开通账号失败。");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const updateParams = (updater: (current: PromptParams) => PromptParams) => {
    setParams((current) => updater(current));
    setStatusMessage("");
  };

  const handleCategoryChange = (productCategory: ProductCategory) => {
    const nextTopic = getDefaultContentTopic(productCategory, dailySlot);
    setContentTopic(nextTopic);
    setContentNonce(0);
    updateParams((current) => ({
      ...current,
      productCategory,
      modelChoice: productCategory === "婚纱 / 礼服" ? "亚洲新娘感模特 25–35" : "轻熟风裙装模特 28–40",
      scenePreference: isSceneCompatibleWithImageType(productCategory, current.imageType, current.scenePreference)
        ? current.scenePreference
        : "自动匹配"
    }));
  };

  const handleImageTypeChange = (imageType: ImageType) => {
    updateParams((current) => ({
      ...current,
      imageType,
      scenePreference: isSceneCompatibleWithImageType(current.productCategory, imageType, current.scenePreference)
        ? current.scenePreference
        : "自动匹配"
    }));
  };

  const copyText = async (text: string, message: string, setMessage: (nextMessage: string) => void = setStatusMessage) => {
    await navigator.clipboard.writeText(text);
    setMessage(message);
  };

  const downloadImage = async (image: GeneratedImage, title: string) => {
    const response = await fetch(image.downloadUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${title || "generated-image"}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleGenerate = async () => {
    if (!session) return;
    if (!referenceFiles.length) {
      setStatusMessage("请先上传至少一张参考图。");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("");

    try {
      const nextNonce = contentNonce + 1;
      const generationParams = { ...params, generationNonce: params.generationNonce + 1 };
      const generatedContent = generateFashionSeedingContent({
        productCategory: generationParams.productCategory,
        baseParams: generationParams,
        imageCount,
        topic: contentTopic,
        dailySlot,
        contentNonce: nextNonce
      });
      const imagePlan = generatedContent.images[0];
      const uploads = await Promise.all(
        referenceFiles.slice(0, 4).map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: await fileToDataUrl(file)
        }))
      );

      const payload = await apiRequest<GenerateResponse>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          promptParams: imagePlan.params,
          title: generatedContent.titles[0],
          body: generatedContent.body,
          tags: generatedContent.tags,
          topic: generatedContent.topic,
          referenceImages: uploads,
          size,
          quality
        })
      });

      setParams(generationParams);
      setContentNonce(nextNonce);
      setLatestRecord(payload.record);
      setStatusMessage("生成完成。");
      await refreshData();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleLogout();
        setLoginError(error.message);
        return;
      }
      setStatusMessage(error instanceof Error ? error.message : "生成失败。");
      await refreshData().catch(() => undefined);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-aura-cream px-4 py-8 text-aura-charcoal">
        <section className="w-full max-w-md rounded-lg bg-aura-porcelain p-6 shadow-aura ring-1 ring-aura-beige">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-aura-muted">Bridal Content Studio</p>
            <h1 className="mt-2 text-2xl font-semibold">账号登录</h1>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className={labelClass}>账号</span>
              <input className={inputClass} value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>密码</span>
              <input
                className={inputClass}
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleLogin();
                }}
              />
            </label>
            {loginError && <p className="rounded-lg bg-[#F6ECEA] px-3 py-2 text-sm text-[#8b423a] ring-1 ring-[#E8CFC9]">{loginError}</p>}
            <button className={`${primaryButtonClass} w-full`} type="button" onClick={handleLogin}>
              登录
            </button>
          </div>
        </section>
      </main>
    );
  }

  const isAdmin = session.user.role === "admin";
  const pageTitle = activeView === "admin" && isAdmin ? "后台管理" : "生图工作台";

  return (
    <main className="min-h-screen bg-aura-cream px-4 py-6 text-aura-charcoal sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="grid gap-4 border-b border-aura-beige pb-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-aura-muted">Bridal & Dress Content Studio</p>
            <h1 className="mt-1 text-2xl font-semibold">{pageTitle}</h1>
          </div>
          {isAdmin && (
            <nav className="flex w-fit rounded-lg bg-white p-1 ring-1 ring-aura-beige" aria-label="页面切换">
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeView === "studio" ? "bg-aura-charcoal text-aura-porcelain" : "text-aura-muted hover:bg-aura-cream"
                }`}
                type="button"
                aria-pressed={activeView === "studio"}
                onClick={() => setActiveView("studio")}
              >
                生图工作台
              </button>
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeView === "admin" ? "bg-aura-charcoal text-aura-porcelain" : "text-aura-muted hover:bg-aura-cream"
                }`}
                type="button"
                aria-pressed={activeView === "admin"}
                onClick={() => setActiveView("admin")}
              >
                后台管理
              </button>
            </nav>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-aura-beige">
              {session.user.displayName} · {isAdmin ? "管理员" : "账号"}
            </span>
            <button className={secondaryButtonClass} type="button" onClick={() => void refreshData()}>
              刷新
            </button>
            <button className={secondaryButtonClass} type="button" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        {activeView === "admin" && isAdmin ? (
          <section className="grid gap-4 md:grid-cols-4">
            <div className={panelClass}>
              <p className="text-sm text-aura-muted">账号数量</p>
              <p className="mt-2 text-2xl font-semibold">{accounts.length}</p>
            </div>
            <div className={panelClass}>
              <p className="text-sm text-aura-muted">总请求</p>
              <p className="mt-2 text-2xl font-semibold">{accountUsageTotals.requestCount}</p>
            </div>
            <div className={panelClass}>
              <p className="text-sm text-aura-muted">成功请求</p>
              <p className="mt-2 text-2xl font-semibold">{accountUsageTotals.successCount}</p>
            </div>
            <div className={panelClass}>
              <p className="text-sm text-aura-muted">失败请求</p>
              <p className="mt-2 text-2xl font-semibold">{accountUsageTotals.failedCount}</p>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className={panelClass}>
                <p className="text-sm text-aura-muted">请求次数</p>
                <p className="mt-2 text-2xl font-semibold">{summary?.requestCount ?? 0}</p>
              </div>
              <div className={panelClass}>
                <p className="text-sm text-aura-muted">成功生成</p>
                <p className="mt-2 text-2xl font-semibold">{summary?.generatedImageCount ?? 0}</p>
              </div>
              <div className={panelClass}>
                <p className="text-sm text-aura-muted">历史保存</p>
                <p className="mt-2 text-2xl font-semibold">{summary?.retentionDays ?? 180} 天</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={panelClass}>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">生成设置</h2>
                  <p className="mt-1 text-sm text-aura-muted">上传参考图后生成图片，生图关键词在后台处理。</p>
                </div>

            <div className="space-y-5">
              <ReferenceImageUploader onChange={setReferenceFiles} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>品类</span>
                  <select className={inputClass} value={params.productCategory} onChange={(event) => handleCategoryChange(event.target.value as ProductCategory)}>
                    {productCategoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>款式</span>
                  <select
                    className={inputClass}
                    value={params.productCategory === "婚纱 / 礼服" ? params.bridalStyle : params.dressStyle}
                    onChange={(event) => {
                      if (params.productCategory === "婚纱 / 礼服") {
                        updateParams((current) => updateField(current, "bridalStyle", event.target.value as BridalStyle));
                      } else {
                        updateParams((current) => updateField(current, "dressStyle", event.target.value as DressStyle));
                      }
                    }}
                  >
                    {(params.productCategory === "婚纱 / 礼服" ? bridalStyleOptions : dressStyleOptions).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>自定义款式名称</span>
                <input
                  className={inputClass}
                  value={params.customProductName}
                  onChange={(event) => updateParams((current) => updateField(current, "customProductName", event.target.value))}
                  placeholder="Pearl Satin A-line"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>图片类型</span>
                  <select className={inputClass} value={params.imageType} onChange={(event) => handleImageTypeChange(event.target.value as ImageType)}>
                    {imageTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>场景</span>
                  <select
                    className={inputClass}
                    value={params.scenePreference}
                    onChange={(event) => updateParams((current) => updateField(current, "scenePreference", event.target.value as ScenePreference))}
                  >
                    {sceneOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>模特</span>
                  <select
                    className={inputClass}
                    value={params.modelChoice}
                    onChange={(event) => updateParams((current) => updateField(current, "modelChoice", event.target.value as ModelChoice))}
                  >
                    {FASHION_MODEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>季节</span>
                  <select className={inputClass} value={params.season} onChange={(event) => updateParams((current) => updateField(current, "season", event.target.value as Season))}>
                    {seasonOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className={labelClass}>光线</span>
                  <select
                    className={inputClass}
                    value={params.lightPreference}
                    onChange={(event) => updateParams((current) => updateField(current, "lightPreference", event.target.value as LightPreference))}
                  >
                    {lightPreferenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>尺寸</span>
                  <select className={inputClass} value={size} onChange={(event) => setSize(event.target.value)}>
                    {sizeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>质量</span>
                  <select className={inputClass} value={quality} onChange={(event) => setQuality(event.target.value)}>
                    {qualityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>补充要求</span>
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={params.extraRequirement}
                  onChange={(event) => updateParams((current) => updateField(current, "extraRequirement", event.target.value))}
                  placeholder="例如：保留缎面垂坠，背景干净，避免夸张摆拍。"
                />
              </label>

              <button className={`${primaryButtonClass} w-full`} type="button" disabled={isGenerating} onClick={handleGenerate}>
                {isGenerating ? "生成中..." : "一键生图"}
              </button>
              {statusMessage && <p className="rounded-lg bg-white px-3 py-2 text-sm text-aura-muted ring-1 ring-aura-beige">{statusMessage}</p>}
            </div>
          </div>

          <div className="space-y-6">
            <section className={panelClass}>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">每日小红书内容</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-aura-muted">
                    选择一个内容主题，自动生成标题、正文、标签和配图方案。生图提示词已隐藏，仅在服务端用于调用 API。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => copyText(formatFashionSeedingContent(contentPreview), "已复制小红书内容全文。", setContentMessage)}
                  >
                    复制全文
                  </button>
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={() => {
                      setContentMessage("");
                      setContentNonce((current) => current + 1);
                    }}
                  >
                    生成小红书内容
                  </button>
                </div>
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_0.7fr_0.7fr]">
                <label className="block space-y-2">
                  <span className={labelClass}>内容主题</span>
                  <select
                    className={inputClass}
                    value={contentTopic}
                    onChange={(event) => {
                      setContentTopic(event.target.value as FashionSeedingTopic);
                      setContentMessage("");
                      setContentNonce(0);
                    }}
                  >
                    {contentTopicOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>今日篇次</span>
                  <select
                    className={inputClass}
                    value={dailySlot}
                    onChange={(event) => {
                      setDailySlot(Number(event.target.value) as FashionSeedingDailySlot);
                      setContentMessage("");
                      setContentNonce(0);
                    }}
                  >
                    {fashionSeedingDailySlotOptions.map((option) => (
                      <option key={option} value={option}>
                        今日第 {option} 篇
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>配图数量</span>
                  <select
                    className={inputClass}
                    value={imageCount}
                    onChange={(event) => {
                      setImageCount(Number(event.target.value) as 3 | 5);
                      setContentMessage("");
                    }}
                  >
                    <option value={3}>3 张</option>
                    <option value={5}>5 张</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-4 rounded-lg bg-white p-4 ring-1 ring-aura-beige">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-aura-muted">
                      {contentPreview.dateKey}｜今日第 {contentPreview.dailySlot} 篇｜{contentPreview.variantLabel}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-aura-charcoal">{contentPreview.topic}</h3>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-aura-charcoal">标题备选</h4>
                    {contentPreview.titles.map((title) => (
                      <p key={title} className="rounded-lg bg-aura-cream px-3 py-2 text-sm text-aura-charcoal ring-1 ring-aura-beige/70">
                        {title}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-aura-charcoal">正文</h4>
                    <p className="whitespace-pre-line rounded-lg bg-aura-cream px-4 py-3 text-sm leading-7 text-aura-charcoal ring-1 ring-aura-beige/70">
                      {contentPreview.body}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-aura-charcoal">标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {contentPreview.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#EEF0E8] px-3 py-1 text-xs text-aura-muted ring-1 ring-[#DDE1D1]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-aura-charcoal">内容逻辑</h4>
                    <p className="rounded-lg bg-[#F6ECEA] px-4 py-3 text-sm leading-6 text-aura-muted ring-1 ring-[#E8CFC9]">
                      {contentPreview.note}
                    </p>
                  </div>

                  {contentMessage && <p className="text-sm text-aura-muted">{contentMessage}</p>}
                </div>

                <div className="grid gap-4">
                  <div className="rounded-lg bg-white p-4 ring-1 ring-aura-beige">
                    <p className="text-sm font-semibold">配图卡片</p>
                    <p className="mt-2 text-sm leading-6 text-aura-muted">
                      每张卡片都有独立的服务端生图参数。提示词不在前端展示，也不提供复制入口。
                    </p>
                  </div>

                  {contentPreview.images.map((image, index) => (
                    <article key={`${image.name}-${index}`} className="rounded-lg bg-white p-4 ring-1 ring-aura-beige">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-aura-charcoal">{image.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-aura-muted">{image.purpose}</p>
                        </div>
                        <span className="rounded-full bg-aura-cream px-3 py-1 text-xs text-aura-muted ring-1 ring-aura-beige">
                          提示词已隐藏
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm leading-6 text-aura-muted sm:grid-cols-2">
                        <p className="rounded-lg bg-aura-cream px-3 py-2 ring-1 ring-aura-beige/70">配图建议：{image.description}</p>
                        <p className="rounded-lg bg-aura-cream px-3 py-2 ring-1 ring-aura-beige/70">
                          参数：{image.params.imageType}｜{image.params.scenePreference}｜{image.params.lightPreference}
                        </p>
                      </div>

                      <div className="mt-4 text-xs text-aura-muted">生图提示词仅在服务端生成和调用，不在前端展示。</div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {latestRecord && (
              <section className={panelClass}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">最新结果</h2>
                    <p className={mutedClass}>{formatDate(latestRecord.createdAt)} · {latestRecord.model}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={secondaryButtonClass} type="button" onClick={() => copyText(latestRecord.title, "已复制标题。")}>
                      复制标题
                    </button>
                    <button className={secondaryButtonClass} type="button" onClick={() => copyText(latestRecord.body, "已复制正文。")}>
                      复制正文
                    </button>
                    <button className={secondaryButtonClass} type="button" onClick={() => copyText(latestRecord.tags.join(" "), "已复制标签。")}>
                      复制标签
                    </button>
                  </div>
                </div>

                {latestRecord.images.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                    <img className="aspect-square w-full rounded-lg object-cover ring-1 ring-aura-beige" src={latestRecord.images[0].url} alt={latestRecord.title} />
                    <div className="space-y-3">
                      <p className="text-base font-medium">{latestRecord.title}</p>
                      <p className={mutedClass}>{latestRecord.body}</p>
                      <div className="flex flex-wrap gap-2">
                        <button className={primaryButtonClass} type="button" onClick={() => downloadImage(latestRecord.images[0], latestRecord.title)}>
                          一键下载
                        </button>
                        <button className={secondaryButtonClass} type="button" onClick={() => copyText(contentText(latestRecord), "已复制标题、正文和标签。")}>
                          复制全部文案
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
          </>
        )}

        {activeView === "admin" && isAdmin && (
          <section className={panelClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">账号管理</h2>
              <span className="text-sm text-aura-muted">共 {accounts.length} 个账号</span>
            </div>

            <div className="mb-6 rounded-lg bg-white p-4 ring-1 ring-aura-beige">
              <h3 className="text-sm font-semibold text-aura-charcoal">开通使用者账号</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="block space-y-2">
                  <span className={labelClass}>账号</span>
                  <input
                    className={inputClass}
                    value={newAccountUsername}
                    onChange={(event) => setNewAccountUsername(event.target.value)}
                    placeholder="例如：lili01"
                    disabled={isCreatingAccount}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>显示名</span>
                  <input
                    className={inputClass}
                    value={newAccountDisplayName}
                    onChange={(event) => setNewAccountDisplayName(event.target.value)}
                    placeholder="例如：Lili"
                    disabled={isCreatingAccount}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>初始密码</span>
                  <input
                    className={inputClass}
                    type="text"
                    value={newAccountPassword}
                    onChange={(event) => setNewAccountPassword(event.target.value)}
                    placeholder="至少 6 位"
                    disabled={isCreatingAccount}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={handleCreateAccount}
                    disabled={isCreatingAccount || !newAccountUsername.trim() || newAccountPassword.length < 6}
                  >
                    {isCreatingAccount ? "开通中..." : "开通账号"}
                  </button>
                </div>
              </div>
              {newAccountMessage && <p className="mt-3 rounded-lg bg-aura-cream px-3 py-2 text-sm text-aura-muted ring-1 ring-aura-beige">{newAccountMessage}</p>}
            </div>

            <h3 className="mb-4 text-sm font-semibold text-aura-charcoal">账号使用情况</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="text-aura-muted">
                  <tr>
                    <th className="border-b border-aura-beige py-2">账号</th>
                    <th className="border-b border-aura-beige py-2">角色</th>
                    <th className="border-b border-aura-beige py-2">请求</th>
                    <th className="border-b border-aura-beige py-2">成功</th>
                    <th className="border-b border-aura-beige py-2">失败</th>
                    <th className="border-b border-aura-beige py-2">图片</th>
                    <th className="border-b border-aura-beige py-2">最近生成</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.user.id}>
                      <td className="border-b border-aura-beige/70 py-3">{account.user.username}</td>
                      <td className="border-b border-aura-beige/70 py-3">{account.user.role}</td>
                      <td className="border-b border-aura-beige/70 py-3">{account.requestCount}</td>
                      <td className="border-b border-aura-beige/70 py-3">{account.successCount}</td>
                      <td className="border-b border-aura-beige/70 py-3">{account.failedCount}</td>
                      <td className="border-b border-aura-beige/70 py-3">{account.generatedImageCount}</td>
                      <td className="border-b border-aura-beige/70 py-3">{formatDate(account.lastGeneratedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">生图历史</h2>
            <span className="text-sm text-aura-muted">最近 {history.length} 条</span>
          </div>

          {history.length === 0 ? (
            <p className={mutedClass}>暂无记录。</p>
          ) : (
            <div className="grid gap-4">
              {history.map((record) => (
                <article key={record.id} className="rounded-lg bg-white p-4 ring-1 ring-aura-beige">
                  <div className="grid gap-4 lg:grid-cols-[150px_1fr_auto]">
                    <div>
                      {record.images[0] ? (
                        <img className="aspect-square w-full rounded-lg object-cover ring-1 ring-aura-beige" src={record.images[0].url} alt={record.title} />
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-lg bg-aura-cream text-sm text-aura-muted ring-1 ring-aura-beige">
                          {record.status === "failed" ? "失败" : "无图"}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-aura-cream px-2.5 py-1 text-xs text-aura-muted ring-1 ring-aura-beige">
                          {formatDate(record.createdAt)}
                        </span>
                        <span className="rounded-full bg-aura-cream px-2.5 py-1 text-xs text-aura-muted ring-1 ring-aura-beige">
                          {record.username}
                        </span>
                        <span className="rounded-full bg-aura-cream px-2.5 py-1 text-xs text-aura-muted ring-1 ring-aura-beige">
                          {record.status}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold">{record.title}</h3>
                      <p className="line-clamp-3 text-sm leading-6 text-aura-muted">{record.status === "failed" ? record.error : record.body}</p>
                      <div className="flex flex-wrap gap-2">
                        {record.tags.slice(0, 8).map((tag) => (
                          <span key={tag} className="rounded-full bg-[#EEF0E8] px-2.5 py-1 text-xs text-aura-muted ring-1 ring-[#DDE1D1]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
                      <button className={secondaryButtonClass} type="button" onClick={() => copyText(record.title, "已复制标题。")}>
                        复制标题
                      </button>
                      <button className={secondaryButtonClass} type="button" onClick={() => copyText(record.body, "已复制正文。")}>
                        复制正文
                      </button>
                      <button className={secondaryButtonClass} type="button" onClick={() => copyText(record.tags.join(" "), "已复制标签。")}>
                        复制标签
                      </button>
                      {record.images[0] && (
                        <button className={primaryButtonClass} type="button" onClick={() => downloadImage(record.images[0], record.title)}>
                          下载图片
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
