import { describe, it, expect } from 'vitest'
import { formatDate } from './format'

describe('formatDate', () => {
  it('returns "-" for null', () => {
    expect(formatDate(null)).toBe('-')
  })

  it('returns "-" for empty string', () => {
    expect(formatDate('')).toBe('-')
  })

  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-07-10T15:30:00Z')
    // Format should be MM/DD HH:mm in zh-CN
    expect(result).toMatch(/\d{2}\/\d{2}/)
    expect(result).not.toBe('-')
  })
})
