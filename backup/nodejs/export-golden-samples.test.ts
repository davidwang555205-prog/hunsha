/**
 * 黄金样本导出脚本（任务②阶段3 验证基准）
 *
 * 用法：npx vitest run scripts/export-golden-samples.test.ts
 *
 * 跑现有 TS 算法 generateFashionSeedingContent，导出固定输入下的确定输出到
 * backend/biz/engines/testdata/golden-samples.json，作为 Go 迁移后 byte-for-byte 比对基准。
 *
 * 固定输入：date=2026-07-10T10:00:00+08:00，baseParams 与 generateFashionSeedingContent.test.ts 一致。
 * 矩阵：2 category × 2 slot × 6 nonce（基础，走 daily.topic）+ 全主题显式覆盖 × 2 nonce + imageCount=3 变体。
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateFashionSeedingContent,
  formatFashionSeedingContent,
  formatFashionSeedingKeywords,
  bridalFashionTopicOptions,
  dressFashionTopicOptions,
  type FashionSeedingTopic,
} from "./generateFashionSeedingContent";
import type { PromptParams, ProductCategory } from "../../src/types";

const FIXED_DATE_ISO = "2026-07-10T10:00:00+08:00";
const FIXED_DATE = new Date(FIXED_DATE_ISO);

// 与 generateFashionSeedingContent.test.ts:13-25 完全一致（Go 侧硬编码同值）
const baseParamsBridal: PromptParams = {
  productCategory: "婚纱 / 礼服",
  bridalStyle: "极简缎面婚纱",
  dressStyle: "连衣裙",
  customProductName: "",
  imageType: "产品上身图",
  modelChoice: "亚洲新娘感模特 25–35",
  season: "夏",
  scenePreference: "自动匹配",
  lightPreference: "自动匹配",
  extraRequirement: "",
  generationNonce: 0,
};

function baseParamsFor(category: ProductCategory): PromptParams {
  return { ...baseParamsBridal, productCategory: category };
}

interface SampleInput {
  productCategory: ProductCategory;
  dailySlot: 1 | 2;
  contentNonce: number;
  topic: FashionSeedingTopic | null; // null 表示走 daily.topic
  imageCount: 3 | 5 | null; // null 表示默认 5
}

interface SampleOutput {
  topic: FashionSeedingTopic;
  dateKey: string;
  dailySlot: 1 | 2;
  variantIndex: number;
  variantCount: number;
  variantLabel: string;
  titles: string[];
  body: string;
  tags: string[];
  note: string;
  images: Array<{
    name: string;
    purpose: string;
    description: string;
    productCategory: ProductCategory;
    imageType: string;
    scenePreference: string;
    modelChoice: string;
    lightPreference: string;
    extraRequirement: string;
    generationNonce: number;
    bridalKeywordProfileId: string | null;
  }>;
}

interface GoldenSample {
  id: string;
  input: SampleInput;
  output: SampleOutput;
  formatContent: string;
  formatKeywords: string;
}

function serializeOutput(content: ReturnType<typeof generateFashionSeedingContent>): SampleOutput {
  return {
    topic: content.topic,
    dateKey: content.dateKey,
    dailySlot: content.dailySlot,
    variantIndex: content.variantIndex,
    variantCount: content.variantCount,
    variantLabel: content.variantLabel,
    titles: content.titles,
    body: content.body,
    tags: content.tags,
    note: content.note,
    images: content.images.map((img) => ({
      name: img.name,
      purpose: img.purpose,
      description: img.description,
      productCategory: img.params.productCategory,
      imageType: img.params.imageType,
      scenePreference: img.params.scenePreference,
      modelChoice: img.params.modelChoice,
      lightPreference: img.params.lightPreference,
      extraRequirement: img.params.extraRequirement,
      generationNonce: img.params.generationNonce,
      bridalKeywordProfileId: img.params.bridalKeywordProfileId ?? null,
    })),
  };
}

function makeSample(input: SampleInput): GoldenSample {
  const base = baseParamsFor(input.productCategory);
  const content = generateFashionSeedingContent({
    productCategory: input.productCategory,
    baseParams: base,
    imageCount: input.imageCount === null ? undefined : input.imageCount,
    topic: input.topic === null ? undefined : input.topic,
    date: FIXED_DATE,
    dailySlot: input.dailySlot,
    contentNonce: input.contentNonce,
  });
  const topicTag = input.topic === null ? "daily" : input.topic;
  const id = `${input.productCategory === "婚纱 / 礼服" ? "bridal" : "dress"}-slot${input.dailySlot}-n${input.contentNonce}-${topicTag}${input.imageCount === 3 ? "-img3" : ""}`;
  return {
    id,
    input,
    output: serializeOutput(content),
    formatContent: formatFashionSeedingContent(content),
    formatKeywords: formatFashionSeedingKeywords(content),
  };
}

function buildAllSamples(): GoldenSample[] {
  const samples: GoldenSample[] = [];
  const categories: ProductCategory[] = ["婚纱 / 礼服", "裙装 / 女装"];

  // 1. 基础矩阵：2 category × 2 slot × 6 nonce（topic 走 daily.topic）
  for (const category of categories) {
    for (const slot of [1, 2] as const) {
      for (const nonce of [0, 1, 2, 3, 4, 5]) {
        samples.push(
          makeSample({
            productCategory: category,
            dailySlot: slot,
            contentNonce: nonce,
            topic: null,
            imageCount: null,
          })
        );
      }
    }
  }

  // 2. 全主题显式覆盖 × 2 nonce（验证 topic override 分支，含 variantIndex = contentNonce % variantCount）
  for (const topic of bridalFashionTopicOptions) {
    for (const nonce of [0, 1]) {
      samples.push(
        makeSample({
          productCategory: "婚纱 / 礼服",
          dailySlot: 1,
          contentNonce: nonce,
          topic,
          imageCount: null,
        })
      );
    }
  }
  for (const topic of dressFashionTopicOptions) {
    for (const nonce of [0, 1]) {
      samples.push(
        makeSample({
          productCategory: "裙装 / 女装",
          dailySlot: 1,
          contentNonce: nonce,
          topic,
          imageCount: null,
        })
      );
    }
  }

  // 3. imageCount=3 变体（验证 3 图切片）
  samples.push(
    makeSample({
      productCategory: "婚纱 / 礼服",
      dailySlot: 1,
      contentNonce: 0,
      topic: null,
      imageCount: 3,
    })
  );
  samples.push(
    makeSample({
      productCategory: "裙装 / 女装",
      dailySlot: 2,
      contentNonce: 3,
      topic: null,
      imageCount: 3,
    })
  );

  return samples;
}

describe("export golden samples", () => {
  it("writes golden-samples.json for Go byte-for-byte verification", () => {
    const samples = buildAllSamples();
    // 去重保护（id 唯一）
    const ids = new Set(samples.map((s) => s.id));
    expect(ids.size).toBe(samples.length);

    const outDir = resolve(process.cwd(), "backend/biz/engines/seeding/testdata");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "golden-samples.json");
    writeFileSync(outPath, JSON.stringify(samples, null, 2) + "\n", "utf8");

    // 基本健全断言
    expect(samples.length).toBeGreaterThan(60);
    for (const s of samples) {
      expect(s.output.titles.length).toBeGreaterThan(0);
      expect(s.output.body.length).toBeGreaterThan(0);
      expect(s.output.tags.length).toBeGreaterThan(0);
      expect(s.output.images.length).toBeGreaterThanOrEqual(3);
      expect(s.formatContent).toContain("## 标题备选");
      expect(s.formatKeywords).toContain("配图 1");
    }
    // eslint-disable-next-line no-console
    console.log(`exported ${samples.length} golden samples -> ${outPath}`);
  });
});
