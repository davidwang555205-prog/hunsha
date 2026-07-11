/**
 * ParamsForm -- 生成参数表单（settings/content 共用，DRY 关键）
 *
 * 品类/款式/自定义款式/图片类型/场景/模特/季节/光线/补充要求。
 * 受控组件：<ParamsForm value={params} onChange={...} />
 * 品类/图片类型切换走 handleCategoryChangeHelper/handleImageTypeChangeHelper（场景兼容联动）。
 */
import { FASHION_MODEL_OPTIONS } from "../../data/fashionModelProfiles";
import { getCompatibleSceneOptions } from "../../data/bridalDressSceneOptions";
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
} from "../../types";
import {
  bridalStyleOptions,
  dressStyleOptions,
  handleCategoryChangeHelper,
  handleImageTypeChangeHelper,
  imageTypeOptions,
  inputClass,
  labelClass,
  lightPreferenceOptions,
  productCategoryOptions,
  qualityOptions,
  seasonOptions,
  sizeOptions,
  updateField
} from "../../studio/constants";
import type { FashionSeedingDailySlot } from "../../utils/generateFashionSeedingContent";

type ParamsFormProps = {
  value: PromptParams;
  /** 参数变更（含品类/图片类型联动） */
  onParamsChange: (updater: (current: PromptParams) => PromptParams) => void;
  /** 品类切换联动回调（外部同步 contentTopic/nonce），携带计算出的默认 topic */
  onCategoryChange: (productCategory: ProductCategory) => void;
  /** 图片类型切换回调（外部清状态） */
  onImageTypeChange?: (imageType: ImageType) => void;
  dailySlot: FashionSeedingDailySlot;
  /** 尺寸（settings 表单展示；不传则不渲染尺寸/质量列） */
  size?: string;
  onSizeChange?: (size: string) => void;
  /** 质量 */
  quality?: string;
  onQualityChange?: (quality: string) => void;
};

export function ParamsForm({
  value: params,
  onParamsChange,
  onCategoryChange,
  onImageTypeChange,
  dailySlot,
  size,
  onSizeChange,
  quality,
  onQualityChange
}: ParamsFormProps) {
  const sceneOptions = getCompatibleSceneOptions(params.productCategory, params.imageType);

  const updateParams = (updater: (current: PromptParams) => PromptParams) => onParamsChange(updater);

  const handleCategory = (productCategory: ProductCategory) => {
    const { params: nextParams } = handleCategoryChangeHelper(params, productCategory, dailySlot);
    onParamsChange(() => nextParams);
    // 外部通过 onCategoryChange 同步 contentTopic/nonce（topic 由外部按 productCategory 重新计算）
    onCategoryChange(productCategory);
  };

  const handleImageType = (imageType: ImageType) => {
    updateParams((current) => handleImageTypeChangeHelper(current, imageType));
    onImageTypeChange?.(imageType);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className={labelClass}>品类</span>
          <select className={inputClass} value={params.productCategory} onChange={(event) => handleCategory(event.target.value as ProductCategory)}>
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
          <select className={inputClass} value={params.imageType} onChange={(event) => handleImageType(event.target.value as ImageType)}>
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
          <select
            className={inputClass}
            value={params.season}
            onChange={(event) => updateParams((current) => updateField(current, "season", event.target.value as Season))}
          >
            {seasonOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={size !== undefined ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
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
        {size !== undefined && onSizeChange && (
          <label className="block space-y-2">
            <span className={labelClass}>尺寸</span>
            <select className={inputClass} value={size} onChange={(event) => onSizeChange(event.target.value)}>
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
        {quality !== undefined && onQualityChange && (
          <label className="block space-y-2">
            <span className={labelClass}>质量</span>
            <select className={inputClass} value={quality} onChange={(event) => onQualityChange(event.target.value)}>
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
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
    </div>
  );
}
