import { describe, expect, it } from "vitest";
import { buildImageDownloadName } from "./download";

describe("buildImageDownloadName", () => {
  it("沿用页面展示的图片名称，并使用真实文件类型的扩展名", () => {
    expect(buildImageDownloadName("图 1 婚纱主图", new Blob(["image"], { type: "image/jpeg" }))).toBe("图 1 婚纱主图.jpg");
  });

  it("仅替换操作系统不允许的文件名字符", () => {
    expect(buildImageDownloadName("图 2：细节/裙摆", new Blob(["image"], { type: "image/png" }))).toBe("图 2：细节-裙摆.png");
  });
});
