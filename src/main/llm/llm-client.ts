import type { LlmSettings } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export async function chatCompletion(
  config: LlmSettings,
  messages: ChatMessage[],
  jsonMode?: boolean
): Promise<LlmResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    }
    if (jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new Error(mapHttpError(res.status, errorText))
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const content = json.choices?.[0]?.message?.content ?? ''
    return {
      content,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens
          }
        : undefined
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(config.timeoutMs / 1000)}秒），请检查网络或增加超时时间`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function mapHttpError(status: number, body: string): string {
  switch (status) {
    case 401:
      return 'API 密钥无效或未提供，请检查设置'
    case 403:
      return 'API 访问被拒绝，请检查密钥权限'
    case 429:
      return 'API 请求频率超限，请稍后再试'
    case 404:
      return 'API 地址或模型不存在，请检查设置'
    default:
      if (status >= 500) {
        return `LLM 服务不可用（${status}），请稍后再试`
      }
      return `LLM 请求失败（${status}）：${body.slice(0, 200)}`
  }
}

/** Extract JSON from LLM response, stripping markdown code blocks if present */
export function extractJson(text: string): unknown {
  let cleaned = text.trim()
  // Remove ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }
  return JSON.parse(cleaned)
}
