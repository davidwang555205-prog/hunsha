/**
 * 素材导出脚本（任务②阶段1）。
 *
 * 用法：npx vitest run --config scripts/vitest.export.config.ts scripts/export-seeding-assets.test.ts
 *
 * 把 generateFashionSeedingContent.ts + xiaohongshuBridalContentProfiles.ts 的纯数据素材
 * 导出为 assets.json，Go 侧用 go:embed 加载，避免手写 2500 行中文数据（byte-for-byte 天然保证）。
 * NarrativePool（模板函数）不在此导出，需 Go 手写。
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  bridalVariationBank,
  dressVariationBank,
  xiaohongshuTopicOverrides,
  topicCopyKits,
  titleStarters,
  titleAngles,
  titleClosers,
  bridalVisualRecipes,
  dressVisualRecipes,
  englishVisualAlignmentByTopic,
  personImageTypes,
  bridalMainSceneByTopic,
  dressMainSceneByTopic,
} from "./generateFashionSeedingContent";
import {
  xiaohongshuBridalCopyDrafts,
  xiaohongshuBridalContentProfiles,
} from "../../src/data/xiaohongshuBridalContentProfiles";
import {
  bridalScenesByImageType,
  dressScenesByImageType,
} from "../../src/data/bridalDressSceneOptions";

describe("export seeding assets", () => {
  it("writes assets.json for Go embed", () => {
    const assets = {
      bridalVariationBank,
      dressVariationBank,
      xiaohongshuTopicOverrides,
      topicCopyKits,
      xiaohongshuBridalCopyDrafts,
      titleStarters,
      titleAngles,
      titleClosers,
      bridalVisualRecipes,
      dressVisualRecipes,
      englishVisualAlignmentByTopic,
      personImageTypes,
      bridalMainSceneByTopic,
      dressMainSceneByTopic,
      xiaohongshuBridalContentProfiles,
      bridalScenesByImageType,
      dressScenesByImageType,
    };

    const outDir = resolve(process.cwd(), "backend/biz/engines/seeding");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "assets.json");
    writeFileSync(outPath, JSON.stringify(assets, null, 2) + "\n", "utf8");

    const keys = Object.keys(assets);
    expect(keys.length).toBeGreaterThan(10);
    // 基本健全断言
    expect(assets.bridalVariationBank.audiences.length).toBe(10);
    expect(assets.titleStarters.length).toBe(10);
    expect(Object.keys(assets.topicCopyKits).length).toBeGreaterThan(20);
    // eslint-disable-next-line no-console
    console.log(`exported ${keys.length} asset groups -> ${outPath}`);
  });
});
