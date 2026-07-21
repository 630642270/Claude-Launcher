import type {
  AvailableModel,
  BenchmarkResult,
  ConnectionTestResult,
  ModelConfig
} from '../shared/types'

const FETCH_TIMEOUT_MS = 3000
const BENCHMARK_TIMEOUT_MS = 60000
const BENCHMARK_MAX_TOKENS = 128
const BENCHMARK_PROMPT = '请从1数到60，每行只写一个数字，不要有其他文字。'

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

function formatBenchmarkMessage(tokensPerSecond: number, ttftSeconds: number): string {
  return `${tokensPerSecond.toFixed(1)} t/s | 首字 ${ttftSeconds.toFixed(1)}s`
}

interface StreamMetrics {
  firstTokenAt: number | null
  outputTokens: number
  textLength: number
}

interface StreamEvent {
  type?: string
  delta?: { text?: unknown }
  usage?: { output_tokens?: unknown }
  error?: { message?: string }
}

/** 解析单条 SSE data 载荷并累计指标，流结束时返回 true */
function handleSseLine(payload: string, metrics: StreamMetrics): boolean {
  if (!payload || payload === '[DONE]') return false

  let event: StreamEvent
  try {
    event = JSON.parse(payload) as StreamEvent
  } catch {
    return false
  }

  if (event.type === 'content_block_delta') {
    const text = event.delta?.text
    if (typeof text === 'string' && text.length > 0) {
      if (metrics.firstTokenAt === null) metrics.firstTokenAt = performance.now()
      metrics.textLength += text.length
    }
  } else if (event.type === 'message_delta') {
    const tokens = event.usage?.output_tokens
    if (typeof tokens === 'number' && tokens > 0) metrics.outputTokens = tokens
  } else if (event.type === 'error') {
    throw new Error(event.error?.message ?? 'API 返回错误')
  } else if (event.type === 'message_stop') {
    return true
  }

  return false
}

/** 发起一次流式对话，测量首字延迟（TTFT）与生成吞吐（t/s） */
export async function benchmarkModel(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<BenchmarkResult> {
  if (!baseUrl.trim()) {
    throw new Error('请先填写 API Base URL')
  }
  if (!apiKey.trim()) {
    throw new Error('请先填写 API Key')
  }
  if (!model.trim()) {
    throw new Error('请先选择主模型')
  }

  const url = `${normalizeBaseUrl(baseUrl)}/v1/messages`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BENCHMARK_TIMEOUT_MS)

  const startedAt = performance.now()
  const metrics: StreamMetrics = { firstTokenAt: null, outputTokens: 0, textLength: 0 }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(apiKey),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model.trim(),
        max_tokens: BENCHMARK_MAX_TOKENS,
        stream: true,
        messages: [{ role: 'user', content: BENCHMARK_PROMPT }]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(mapError(response.status, body))
    }
    if (!response.body) {
      throw new Error('该地址不支持流式响应，无法测速')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let stopped = false

    while (!stopped) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line.startsWith('data:')) {
          stopped = handleSseLine(line.slice(5).trim(), metrics)
        }
        newlineIndex = buffer.indexOf('\n')
      }
    }

    const finishedAt = performance.now()
    if (metrics.firstTokenAt === null) {
      throw new Error('未收到任何输出，无法测速')
    }

    const ttftSeconds = (metrics.firstTokenAt - startedAt) / 1000
    const generationSeconds = Math.max((finishedAt - metrics.firstTokenAt) / 1000, 0.001)
    const outputTokens =
      metrics.outputTokens > 0 ? metrics.outputTokens : Math.max(Math.round(metrics.textLength / 3), 1)
    const tokensPerSecond = outputTokens / generationSeconds

    return {
      ok: true,
      message: formatBenchmarkMessage(tokensPerSecond, ttftSeconds),
      tokensPerSecond,
      ttftSeconds,
      outputTokens
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, message: '测速超时，请检查网络或模型是否可用' }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(timer)
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
