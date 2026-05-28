import { getAIConfig, DEFAULT_MODELS, DEFAULT_BASE_URLS } from '@/config/ai'
import type { Repository } from '@/types'

export interface ChatConfig {
  provider: string
  apiKey: string
  baseURL: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function getChatConfig(): ChatConfig {
  const config = getAIConfig()
  return {
    provider: config.provider,
    apiKey: config.apiKey,
    baseURL: config.baseURL || DEFAULT_BASE_URLS[config.provider],
    model: config.model || DEFAULT_MODELS[config.provider]
  }
}

export function buildSingleRepoSysPrompt(repo: Repository, readmeContent?: string): string {
  let prompt = `You are an AI assistant helping a user understand a GitHub repository.
Answer questions concisely in the same language the user asks.
Use the repository information and README below as your knowledge base.

## Repository Information
- Name: ${repo.full_name}
- Description: ${repo.description || 'N/A'}
- Language: ${repo.language || 'N/A'}
- Topics: ${repo.topics?.join(', ') || 'N/A'}
- Stars: ${repo.stargazers_count}
- Forks: ${repo.forks_count}
- License: ${repo.license?.spdx_id || 'N/A'}
- Last Updated: ${repo.updated_at}
`

  if (readmeContent) {
    const truncated = readmeContent.length > 6000
      ? readmeContent.substring(0, 6000) + '\n\n[README truncated due to length]'
      : readmeContent
    prompt += `\n## README\n${truncated}\n`
  } else {
    prompt += '\nNote: No README content is available for this repository. Answer based on metadata only.\n'
  }

  return prompt
}

export function buildMultiRepoSysPrompt(repos: Repository[]): string {
  const summary = repos.map((r, i) =>
    `${i + 1}. **${r.full_name}** | ${r.language || 'N/A'} | ${r.stargazers_count} stars\n   ${r.description || 'No description'}${r.topics?.length ? ` | topics: ${r.topics.join(', ')}` : ''}`
  ).join('\n')

  return `You are an AI assistant helping a user explore their starred GitHub repositories.
Answer questions concisely in the same language the user asks.
Use the repository list below as your knowledge base.

The user has ${repos.length} starred repositories:

${summary}

Help the user find, compare, and understand repositories from this list.
If the user asks about a specific repo not in the list, let them know.`
}

export async function streamChat(
  messages: ChatMessage[],
  config: ChatConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { provider, apiKey, baseURL, model } = config

  if (provider === 'claude') {
    return streamClaude(messages, apiKey, baseURL, model, onChunk, signal)
  }
  // OpenAI, Qwen, Zhipu, DeepSeek all use OpenAI-compatible streaming
  return streamOpenAICompatible(messages, apiKey, baseURL, model, onChunk, signal)
}

async function streamOpenAICompatible(
  messages: ChatMessage[],
  apiKey: string,
  baseURL: string,
  model: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    }),
    signal
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('rate_limit')
    }
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            onChunk(delta)
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullText
}

async function streamClaude(
  messages: ChatMessage[],
  apiKey: string,
  baseURL: string,
  model: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const userMsgs = messages.filter(m => m.role !== 'system')

  const response = await fetch(`${baseURL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemMsg?.content || '',
      messages: userMsgs,
      stream: true
    }),
    signal
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('rate_limit')
    }
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)

        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta?.text
            if (delta) {
              fullText += delta
              onChunk(delta)
            }
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullText
}
