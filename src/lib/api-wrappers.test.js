import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProgress, parseJsonResponse, resetProgress, saveProgress } from './api'
import {
  addWordToBook,
  clearWordBook,
  fetchWordBook,
  removeWordFromBook,
  replaceWordBook,
} from './api-wordbooks'
import {
  apiAddReviewCard,
  apiDeleteReviewCard,
  apiFetchReviewCards,
  apiResetReviewCards,
  apiUpsertReviewCards,
} from './api-review'
import { fetchSettings, updateSettings } from './api-settings'
import { fetchFavoriteDicts, toggleFavoriteDict } from './api-favorites'

function makeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

const wrapperCalls = [
  ['fetchProgress', () => fetchProgress('cet4')],
  ['saveProgress', () => saveProgress('cet4', 1, ['hello'])],
  ['resetProgress', () => resetProgress('cet4')],
  ['fetchWordBook', () => fetchWordBook('errors')],
  ['addWordToBook', () => addWordToBook('errors', { name: 'hello' })],
  ['removeWordFromBook', () => removeWordFromBook('errors', 'hello')],
  ['clearWordBook', () => clearWordBook('errors')],
  ['replaceWordBook', () => replaceWordBook('errors', [{ name: 'hello' }])],
  ['apiFetchReviewCards', () => apiFetchReviewCards()],
  ['apiAddReviewCard', () => apiAddReviewCard('hello', 'cet4')],
  ['apiDeleteReviewCard', () => apiDeleteReviewCard('ice cream')],
  ['apiUpsertReviewCards', () => apiUpsertReviewCards([{ wordName: 'hello' }])],
  ['apiResetReviewCards', () => apiResetReviewCards()],
  ['fetchSettings', () => fetchSettings()],
  ['updateSettings', () => updateSettings({ dailyGoal: 20 })],
  ['fetchFavoriteDicts', () => fetchFavoriteDicts()],
  ['toggleFavoriteDict', () => toggleFavoriteDict('cet4')],
]

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('parseJsonResponse', () => {
  it('returns the parsed body for a successful response', async () => {
    const payload = { success: true }

    await expect(parseJsonResponse(makeResponse(payload))).resolves.toBe(payload)
  })

  it('uses the HTTP status when an unsuccessful response is not valid JSON', async () => {
    const response = makeResponse(null, 502)
    response.json.mockRejectedValueOnce(new SyntaxError('Unexpected token'))

    await expect(parseJsonResponse(response)).rejects.toThrow('请求失败 (502)')
  })
})

describe('JSON API wrappers', () => {
  it.each(wrapperCalls)(
    '%s rejects a non-2xx response with the server error',
    async (_name, call) => {
      fetchMock.mockResolvedValueOnce(makeResponse({ error: '同步失败' }, 500))

      await expect(call()).rejects.toThrow('同步失败')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  it('apiDeleteReviewCard 对路径中的空格等字符编码', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ success: true }))

    await expect(apiDeleteReviewCard('ice cream')).resolves.toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/review/ice%20cream',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
