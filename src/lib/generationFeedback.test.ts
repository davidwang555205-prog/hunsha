import { describeGenerationFailure } from "./generationFeedback";
import { describe, expect, it } from "vitest";

describe("describeGenerationFailure", () => {
  it("将积分不足转为可行动的用户提示并标记联系客服", () => {
    expect(describeGenerationFailure(Object.assign(new Error("积分余额不足。当前余额 1，本次需要 3 积分。"), { statusCode: 402 }))).toEqual({
      title: "积分不足",
      message: "当前积分不足以完成本次生成，请联系客服充值后重试。",
      action: "contact-service"
    });
  });

  it("非积分不足的错误不带 contact-service 动作标记", () => {
    const feedback = describeGenerationFailure("WalaAPI 上游负载已饱和，已自动重试 3 次仍未成功。");
    expect(feedback.action).toBeUndefined();
  });

  it("将模型线路 404 转为线路不可用提示", () => {
    expect(describeGenerationFailure("404 Not Found")).toEqual({
      title: "模型线路暂不可用",
      message: "当前模型线路未能响应，请稍后重试或联系管理员切换线路。"
    });
  });

  it("将模型超时与负载饱和归为线路繁忙", () => {
    expect(describeGenerationFailure("WalaAPI 上游负载已饱和，已自动重试 3 次仍未成功。")).toEqual({
      title: "模型线路繁忙",
      message: "模型服务当前繁忙，系统已自动尝试其他线路但仍未完成，请稍后重试。"
    });
  });

  it("将图片解析错误转为上传指引", () => {
    expect(describeGenerationFailure("产品参考图解析失败。")).toEqual({
      title: "图片没有上传成功",
      message: "请上传 4–6 张能正常打开的 JPG、PNG 或 WebP 商品图，单张不超过 10MB，然后重新生成。"
    });
  });

  it("将模型参考图兼容错误转为可行动提示", () => {
    expect(describeGenerationFailure("Invalid image file or mode for image 1")).toEqual({
      title: "图片未能生成",
      message: "图片格式或大小不符合要求，请调整后重新上传。未成功生成的图片不会扣积分。"
    });
  });
});
