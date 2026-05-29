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

/**
 * Build system prompt for smart filter mode.
 * Tells the AI it can output structured action markers
 * that the UI will parse and execute.
 */
export function buildSmartFilterSysPrompt(repos: Repository[]): string {
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))].sort()
  const tags = [
    'Web 开发', '移动开发', '数据科学', '工具库', 'DevOps',
    '游戏开发', '数据库', '安全', '区块链', '编程语言',
    '系统编程', '设计', '文档', '测试', 'Node.js', 'React'
  ]

  return `You are a smart filter assistant for a GitHub Stars manager app.

## YOUR CAPABILITIES
You can do THREE things:
1. **Answer questions** about the user's starred repos
2. **Filter repos** by outputting [[FILTER:...]] markers
3. **Discover repos** by outputting [[DISCOVER:...]] markers

## FILTER MARKERS
When the user asks to find/filter repos, append a marker at the end:
- [[FILTER:query="关键词"]] — search by name/description
- [[FILTER:query="关键词" language="Python"]] — search + language filter
- [[FILTER:tag="Web 开发"]] — filter by tag name
- [[FILTER:language="TypeScript"]] — filter by language only
- You can combine: query, language, tag

Available languages: ${langs.join(', ')}
Available tag names: ${tags.join(', ')}

## DISCOVER MARKERS
When the user asks to discover/recommend NEW projects (not in their stars), append:
- [[DISCOVER:query="machine learning stars:>1000"]] — search GitHub for repos
- Use GitHub search syntax: keywords + stars:>N + language:xxx + topic:xxx + sort:stars-desc
- Always include stars:>500 for quality filtering

## EXAMPLES
User: "帮我找前端项目"
AI: 我找到了这些前端相关的项目... [[FILTER:query="frontend"]]

User: "有哪些Python的项目"
AI: Python项目有以下这些... [[FILTER:language="Python"]]

User: "推荐一些好的机器学习项目"
AI: 让我在 GitHub 上搜索高质量机器学习项目... [[DISCOVER:query="machine learning stars:>3000 sort:stars-desc"]]

User: "Web开发相关的"
AI: 以下是Web开发分类的项目... [[FILTER:tag="Web 开发"]]

## RULES
- Always explain what you found before outputting markers
- For FILTER: show matching repo count and list a few examples
- For DISCOVER: explain why these projects are high-quality
- Use the SAME language as the user's question
- Output AT MOST ONE marker per response`
}

// Parse smart filter action markers from text
export function parseSmartActions(text: string): SmartAction[] {
  const actions: SmartAction[] = []

  // Parse [[FILTER:...]]
  const filterMatch = text.match(/\[\[FILTER:([^\]]+)\]\]/)
  if (filterMatch) {
    const params = filterMatch[1]
    const query = params.match(/query="([^"]*)"/)?.[1]
    const language = params.match(/language="([^"]*)"/)?.[1]
    const tag = params.match(/tag="([^"]*)"/)?.[1]
    actions.push({ type: 'filter', query, language, tag })
  }

  // Parse [[TAG:...]]
  const tagMatch = text.match(/\[\[TAG:([^\]]+)\]\]/)
  if (tagMatch) {
    const params = tagMatch[1]
    const tagName = params.match(/tagName="([^"]*)"/)?.[1]
    if (tagName) actions.push({ type: 'tag', tagName })
  }

  // Parse [[DISCOVER:...]]
  const discoverMatch = text.match(/\[\[DISCOVER:([^\]]+)\]\]/)
  if (discoverMatch) {
    const params = discoverMatch[1]
    const query = params.match(/query="([^"]*)"/)?.[1]
    if (query) actions.push({ type: 'discover', query })
  }

  return actions
}

export interface SmartAction {
  type: 'filter' | 'tag' | 'discover'
  query?: string
  language?: string
  tag?: string
  tagName?: string
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
