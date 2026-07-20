import { describe, expect, it } from "vitest";
import { buildImageDownloadName, normalizeImageDisplayName } from "./download";

describe("buildImageDownloadName", () => {
  it("沿用页面展示的图片名称，并使用真实文件类型的扩展名", () => {
    expect(buildImageDownloadName("图 1 婚纱主图", new Blob(["image"], { type: "image/jpeg" }))).toBe("图 1 婚纱主图.jpg");
  });

  it("仅替换操作系统不允许的文件名字符", () => {
    expect(buildImageDownloadName("图 2：细节/裙摆", new Blob(["image"], { type: "image/png" }))).toBe("图 2：细节-裙摆.png");
  });
});

describe("normalizeImageDisplayName — 新格式（图N-brief）", () => {
  it("已是新格式（带 brief）：原样返回", () => {
    expect(normalizeImageDisplayName("图1-主图", 0)).toBe("图1-主图");
    expect(normalizeImageDisplayName("图5-静物", 4)).toBe("图5-静物");
  });

  it("已是新格式（裸序号无 brief）：原样返回", () => {
    expect(normalizeImageDisplayName("图3", 2)).toBe("图3");
  });

  it("未识别 imageType 降级裸序号：原样返回", () => {
    expect(normalizeImageDisplayName("图10", 9)).toBe("图10");
  });
});

describe("normalizeImageDisplayName — 历史半角竖线格式（图N|brief|purpose）", () => {
  it("标准三段：取前两段拼成 图N-brief", () => {
    expect(normalizeImageDisplayName("图1|主图|完整状态", 0)).toBe("图1-主图");
    expect(normalizeImageDisplayName("图2|情绪|同一模特风格", 1)).toBe("图2-情绪");
  });

  it("两段（purpose 缺失）：拼成 图N-brief", () => {
    expect(normalizeImageDisplayName("图3|细节", 2)).toBe("图3-细节");
  });

  it("purpose 超过 30 字符时不影响（只取前两段）", () => {
    const longPurpose = "x".repeat(50);
    expect(normalizeImageDisplayName(`图1|主图|${longPurpose}`, 0)).toBe("图1-主图");
  });

  it("仅一段（无竖线但有裸图N）：走新格式分支原样返回", () => {
    expect(normalizeImageDisplayName("图4", 3)).toBe("图4");
  });

  it("brief 为空（形如 图N|）：只剩 head，返回 图N", () => {
    expect(normalizeImageDisplayName("图1|", 0)).toBe("图1");
  });
});

describe("normalizeImageDisplayName — 历史全角竖线格式（图N｜brief｜purpose）", () => {
  it("标准三段：取前两段拼成 图N-brief", () => {
    expect(normalizeImageDisplayName("图1｜主图｜完整状态", 0)).toBe("图1-主图");
    expect(normalizeImageDisplayName("图5｜静物｜挂装与配件", 4)).toBe("图5-静物");
  });

  it("两段（purpose 缺失）：拼成 图N-brief", () => {
    expect(normalizeImageDisplayName("图2｜对镜", 1)).toBe("图2-对镜");
  });

  it("混合半角+全角：均识别", () => {
    expect(normalizeImageDisplayName("图3|细节｜面料与工艺", 2)).toBe("图3-细节");
    expect(normalizeImageDisplayName("图3｜细节|面料与工艺", 2)).toBe("图3-细节");
  });
});

describe("normalizeImageDisplayName — 兜底与异常分支", () => {
  it("undefined：返回 图{index+1}", () => {
    expect(normalizeImageDisplayName(undefined, 0)).toBe("图1");
    expect(normalizeImageDisplayName(undefined, 4)).toBe("图5");
  });

  it("空字符串：返回 图{index+1}", () => {
    expect(normalizeImageDisplayName("", 0)).toBe("图1");
    expect(normalizeImageDisplayName("   ", 2)).toBe("图3");
  });

  it("含竖线但 head 不是 图N：返回 图{index+1}（兜底）", () => {
    expect(normalizeImageDisplayName("PMS-001｜F01-正面｜A01-站立", 0)).toBe("图1");
    expect(normalizeImageDisplayName("abc|def|ghi", 2)).toBe("图3");
  });

  it("前后空白被 trim", () => {
    expect(normalizeImageDisplayName("  图1-主图  ", 0)).toBe("图1-主图");
  });

  it("竖线片段前后空白被 trim", () => {
    expect(normalizeImageDisplayName(" 图1 | 主图 | 完整状态 ", 0)).toBe("图1-主图");
  });
});

describe("normalizeImageDisplayName — 自定义名（尊重用户/蓝图）", () => {
  it("不含竖线且非 图N 前缀：原样返回", () => {
    expect(normalizeImageDisplayName("婚纱正面照", 0)).toBe("婚纱正面照");
    expect(normalizeImageDisplayName("cover", 0)).toBe("cover");
  });

  it("特殊字符（连字符在内）保留", () => {
    expect(normalizeImageDisplayName("图1-主图- extra", 0)).toBe("图1-主图- extra");
  });
});

describe("normalizeImageDisplayName — index 参数语义", () => {
  it("index 从 0 开始但显示从 1 开始", () => {
    expect(normalizeImageDisplayName(undefined, 0)).toBe("图1");
    expect(normalizeImageDisplayName(undefined, 9)).toBe("图10");
  });

  it("提供的 name 优先于 index 派生", () => {
    // name 是 "图5-静物" 但 index=0：以 name 为准
    expect(normalizeImageDisplayName("图5-静物", 0)).toBe("图5-静物");
  });
});
