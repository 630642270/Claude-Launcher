import type { AvailableModel, ConnectionTestResult, ModelConfig } from '../shared/types'

const FETCH_TIMEOUT_MS = 3000

interface ModelsApiResponse {
  data?: Array<{
    id?: string
    display_name?: string
  }>
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Build the models list URL from optional modelsUrl or default baseUrl/v1/models. */
export function resolveModelsListUrl(baseUrl: string, modelsUrl?: string): string {
  const custom = modelsUrl?.trim()
  if (custom) {
    const normalized = normalizeBaseUrl(custom)
    const withModels = /\/models$/i.test(normalized) ? normalized : `${normalized}/models`
    return withModels.includes('?') ? `${withModels}&limit=1000` : `${withModels}?limit=1000`
  }

  const normalized = normalizeBaseUrl(baseUrl)
  return `${normalized}/v1/models?limit=1000`
}

function buildAuthHeaders(apiKey: string): Record<string, string> {
  return {
    'anthropic-version': '2023-06-01',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  }
}

function mapError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'API Key 无效或无权访问'
  }
  if (status === 404) {
    return '该地址不支持模型列表端点，可填写「模型列表地址」或手动填写模型 ID'
  }
  if (status >= 500) {
    return `服务端错误 (${status})`
  }
  if (body) {
    return `请求失败 (${status}): ${body.slice(0, 120)}`
  }
  return `请求失败 (${status})`
}

export async function fetchModels(
  baseUrl: string,
  apiKey: string,
  modelsUrl?: string
): Promise<AvailableModel[]> {
  if (!baseUrl.trim() && !modelsUrl?.trim()) {
    throw new Error('请先填写 API Base URL 或模型列表地址')
  }
  if (!apiKey.trim()) {
    throw new Error('请先填写 API Key')
  }

  const url = resolveModelsListUrl(baseUrl, modelsUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(apiKey),
      signal: controller.signal,
      redirect: 'error'
    })

    const body = await response.text()

    if (!response.ok) {
      throw new Error(mapError(response.status, body))
    }

    let parsed: ModelsApiResponse
    try {
      parsed = JSON.parse(body) as ModelsApiResponse
    } catch {
      throw new Error('模型列表响应格式无效')
    }

    const models = (parsed.data ?? [])
      .filter((item) => typeof item.id === 'string' && item.id.length > 0)
      .map((item) => ({
        id: item.id as string,
        displayName: item.display_name
      }))

    if (models.length === 0) {
      throw new Error('未从 API 获取到可用模型')
    }

    return models
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络或 Base URL')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function testConnection(
  baseUrl: string,
  apiKey: string,
  modelsUrl?: string
): Promise<ConnectionTestResult> {
  try {
    const models = await fetchModels(baseUrl, apiKey, modelsUrl)
    return {
      ok: true,
      message: `连接成功，发现 ${models.length} 个模型`,
      models
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      models: []
    }
  }
}

function findModel(models: AvailableModel[], patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = models.find((model) => pattern.test(model.id.toLowerCase()))
    if (match) return match.id
  }
  return ''
}

export function suggestModelMapping(models: AvailableModel[]): Partial<ModelConfig> {
  if (models.length === 0) return {}

  const ids = models.map((m) => m.id)

  const pick = (index: number, patterns: RegExp[]): string => {
    const matched = findModel(models, patterns)
    if (matched) return matched
    return ids[Math.min(index, ids.length - 1)] ?? ''
  }

  return {
    main: pick(0, [/pro/, /opus/, /sonnet/]),
    opus: pick(1, [/opus/, /pro/]),
    sonnet: pick(2, [/sonnet/, /pro/]),
    haiku: pick(3, [/haiku/, /flash/]),
    subagent: pick(4, [/flash/, /haiku/, /subagent/])
  }
}
