import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiRequest, setTokenGetter, setUnauthorizedHandler } from './client'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  setTokenGetter(() => null)
  setUnauthorizedHandler(() => {})
})

describe('apiRequest', () => {
  it('returns parsed JSON on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc', user: { id: '1' } }),
    })

    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'pass' }),
    })

    expect(result).toEqual({ token: 'abc', user: { id: '1' } })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('injects Authorization header when token is available', async () => {
    setTokenGetter(() => 'my-token')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })

    await apiRequest('/api/me')

    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer my-token')
  })

  it('throws ApiError with statusCode on non-ok response', async () => {
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

    await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'a' }),
    })

    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })
})
