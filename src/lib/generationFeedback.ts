import type { ApiError } from "../types/api";

export type GenerationFeedback = {
  title: string;
  message: string;
};

const fallbackFeedback: GenerationFeedback = {
  title: "生成未完成",
  message: "本次生成未完成，请稍后重试。"
};

/** 将接口与异步任务的技术错误转换为用户可理解、可行动的生图提示。 */
export function describeGenerationFailure(error: unknown): GenerationFeedback {
  const apiError = error as ApiError | undefined;
  const statusCode = apiError?.statusCode;
  const raw = error instanceof Error ? error.message.trim() : typeof error === "string" ? error.trim() : "";

  if (statusCode === 402 || raw.includes("积分余额不足")) {
    return { title: "积分不足", message: "当前积分不足以完成本次生成，请联系管理员充值后重试。" };
  }
  if (raw.includes("今日生成图片额度不足")) {
    return { title: "今日额度已用完", message: "今日可生成图片额度不足，请明天再试或联系管理员调整额度。" };
  }
  if (statusCode === 413) {
    return { title: "图片文件过大", message: "请压缩图片后重新上传，单次上传内容不能超过系统限制。" };
  }
  if (/Invalid image file or mode for image/i.test(raw)) {
    return {
      title: "图片未能生成",
      message: "图片格式或大小不符合要求，请调整后重新上传。未成功生成的图片不会扣积分。"
    };
  }
  if (/参考图|产品图|图片|图像|文件读取|文件上传|data\s*url/i.test(raw)) {
    return { title: "图片没有上传成功", message: "请上传 4–6 张能正常打开的 JPG、PNG 或 WebP 商品图，单张不超过 10MB，然后重新生成。" };
  }
  if (statusCode === 404 || raw === "404 Not Found") {
    return { title: "模型线路暂不可用", message: "当前模型线路未能响应，请稍后重试或联系管理员切换线路。" };
  }
  if (
    statusCode === 429 ||
    /负载已饱和|线路繁忙|context deadline exceeded|超过 \d+ 秒未返回|请求超时/i.test(raw)
  ) {
    return { title: "模型线路繁忙", message: "模型服务当前繁忙，系统已自动尝试其他线路但仍未完成，请稍后重试。" };
  }
  if (statusCode === 401) {
    return { title: "登录已失效", message: "请重新登录后再生成。" };
  }
  if (/网络请求失败|无法连接|网络连接|请求已取消/i.test(raw)) {
    return { title: "网络连接异常", message: "暂时无法连接服务，请检查网络后重试。" };
  }
  if ((statusCode ?? 0) >= 500) {
    return { title: "服务暂时不可用", message: "服务出现短暂异常，请稍后重试。" };
  }
  return raw ? { title: fallbackFeedback.title, message: raw } : fallbackFeedback;
}
