import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiRequest, setUnauthorizedHandler } from './client'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  setUnauthorizedHandler(() => {})
})

describe('apiRequest', () => {
  it('returns parsed JSON on successful response (8 模块扁平)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [] }),
    })

    const result = await apiRequest('/api/channels')

    expect(result).toEqual({ channels: [] })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('解包 web.Resp {code,message,data} -> data（team 路由）', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { id: '1', email: 'a@b.com' } }),
    })

    const result = await apiRequest('/api/v1/teams/users/status')

    expect(result).toEqual({ id: '1', email: 'a@b.com' })
  })

  it('web.Resp 业务码非 0（HTTP 200）抛 ApiError，不再静默返回 data=null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 10606, message: '登录失败', data: null }),
    })

    await expect(
      apiRequest('/api/v1/teams/users/login', { method: 'POST', body: '{}' })
    ).rejects.toMatchObject({ message: '登录失败', statusCode: 200 })
  })

  it('web.Resp 业务码非 0 即使省略 data 也抛 ApiError，避免错误登录态跳页', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 10606, message: '登录失败' }),
    })

    await expect(
      apiRequest('/api/v1/teams/users/login', { method: 'POST', body: '{}' })
    ).rejects.toMatchObject({ message: '登录失败', statusCode: 200 })
  })

  it('sends credentials: include (cookie session)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiRequest('/api/me')

    expect(mockFetch.mock.calls[0][1].credentials).toBe('include')
  })

  it('throws ApiError with statusCode on non-ok response (error 字段)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: '服务器内部错误' }),
    })

    await expect(apiRequest('/api/me')).rejects.toMatchObject({
      message: '服务器内部错误',
      statusCode: 500,
    })
  })

  it('错误归一化：team {message} 字段也识别', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ code: 1, message: '参数错误' }),
    })

    await expect(apiRequest('/api/v1/teams/users')).rejects.toMatchObject({
      message: '参数错误',
      statusCode: 400,
    })
  })

  it('calls unauthorizedHandler on 401', async () => {
    const logout = vi.fn()
    setUnauthorizedHandler(logout)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: '登录已失效' }),
    })

    await expect(apiRequest('/api/me')).rejects.toMatchObject({ statusCode: 401 })
    expect(logout).toHaveBeenCalledOnce()
  })

  it('sets Content-Type to application/json when body is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiRequest('/api/v1/teams/users/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
    })

    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })
})
