import { describe, it, expect } from 'vitest'
import {
  generateFashionSeedingContent,
  formatFashionSeedingContent,
  formatFashionSeedingKeywords,
  getLocalDateKey,
  getFashionSeedingTopicOptions,
  bridalFashionTopicOptions,
  dressFashionTopicOptions,
} from './generateFashionSeedingContent'
import type { PromptParams, ProductCategory } from '../../src/types'

const baseParams: PromptParams = {
  productCategory: '婚纱 / 礼服',
  bridalStyle: '极简缎面婚纱',
  dressStyle: '连衣裙',
  customProductName: '',
  imageType: '产品上身图',
  modelChoice: '亚洲新娘感模特 25–35',
  season: '夏',
  scenePreference: '自动匹配',
  lightPreference: '自动匹配',
  extraRequirement: '',
  generationNonce: 0,
}

describe('getLocalDateKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = getLocalDateKey(new Date('2026-07-10T15:00:00+08:00'))
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getFashionSeedingTopicOptions', () => {
  it('returns bridal topics for 婚纱 / 礼服', () => {
    const topics = getFashionSeedingTopicOptions('婚纱 / 礼服' as ProductCategory)
    expect(topics.length).toBeGreaterThan(0)
    expect(topics).toEqual(bridalFashionTopicOptions)
  })

  it('returns dress topics for 裙装 / 女装', () => {
    const topics = getFashionSeedingTopicOptions('裙装 / 女装' as ProductCategory)
    expect(topics.length).toBeGreaterThan(0)
    expect(topics).toEqual(dressFashionTopicOptions)
  })
})

describe('generateFashionSeedingContent', () => {
  it('generates content with 5 images by default', () => {
    const content = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
    })

    expect(content.topic).toBeTruthy()
    expect(content.images).toHaveLength(5)
    expect(content.titles.length).toBeGreaterThan(0)
    expect(content.body).toBeTruthy()
    expect(content.tags.length).toBeGreaterThan(0)
    expect(content.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('generates content with 3 images when imageCount=3', () => {
    const content = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      imageCount: 3,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
    })

    expect(content.images).toHaveLength(3)
  })

  it('produces consistent output for same input (snapshot)', () => {
    const content = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
      contentNonce: 0,
    })

    // 快照测试：锁定确定性输出
    expect(content).toMatchSnapshot()
  })

  it('produces different variant with different contentNonce', () => {
    const c1 = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
      contentNonce: 0,
    })

    const c2 = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
      contentNonce: 1,
    })

    // 不同 nonce 应产生不同 variant（除非只有1个variant）
    if (c1.variantCount > 1) {
      expect(c1.variantIndex).not.toBe(c2.variantIndex)
    }
  })

  it('generates dress content for 裙装 / 女装', () => {
    const content = generateFashionSeedingContent({
      productCategory: '裙装 / 女装' as ProductCategory,
      baseParams: { ...baseParams, productCategory: '裙装 / 女装' as ProductCategory },
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 2,
    })

    expect(content.topic).toBeTruthy()
    expect(dressFashionTopicOptions).toContain(content.topic)
    expect(content.images.length).toBeGreaterThan(0)
  })
})

describe('formatFashionSeedingContent', () => {
  it('produces formatted string with all sections', () => {
    const content = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
    })

    const formatted = formatFashionSeedingContent(content)
    expect(formatted).toContain('## 标题备选')
    expect(formatted).toContain('## 正文')
    expect(formatted).toContain('## 标签')
    expect(formatted).toContain('## 配图方案')
  })
})

describe('formatFashionSeedingKeywords', () => {
  it('produces keyword format with image params', () => {
    const content = generateFashionSeedingContent({
      productCategory: '婚纱 / 礼服' as ProductCategory,
      baseParams,
      date: new Date('2026-07-10T10:00:00+08:00'),
      dailySlot: 1,
    })

    const keywords = formatFashionSeedingKeywords(content)
    expect(keywords).toContain('配图 1')
    expect(keywords).toContain('用途：')
    expect(keywords).toContain('---')
  })
})
