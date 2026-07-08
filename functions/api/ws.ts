/**
 * StarHub WebSocket Worker (TypeScript)
 *
 * 处理 WebSocket 连接，提供：
 * - 语义搜索 embedding (Workers AI)
 * - AI 仓库分类
 * - 实时进度推送
 */

interface Env {
  AI: any
  DB: D1Database
}

interface WsMessage {
  type: string
  payload?: Record<string, unknown>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const upgrade = request.headers.get('Upgrade') || ''
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    server.accept()

    handleSession(server, env)

    return new Response(null, { status: 101, webSocket: client })
  }
}

async function handleSession(ws: WebSocket, env: Env): Promise<void> {
  ws.addEventListener('message', async (event: MessageEvent) => {
    try {
      const msg: WsMessage = JSON.parse(event.data as string)

      switch (msg.type) {
        // ── Health ──
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', payload: {} }))
          break

        // ── Semantic Search Embedding ──
        case 'search:embed': {
          const text = (msg.payload as any)?.text
          if (!text) {
            ws.send(JSON.stringify({ type: 'error', payload: { detail: 'text is required' } }))
            return
          }
          const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
          const vector = result.data?.[0]?.embedding
          ws.send(JSON.stringify({ type: 'search:embed:result', payload: { vector } }))
          break
        }

        // ── AI Repo Classification ──
        case 'repo:classify': {
          const repo = (msg.payload as any)?.repo
          if (!repo) {
            ws.send(JSON.stringify({ type: 'error', payload: { detail: 'repo is required' } }))
            return
          }
          const category = await classifyRepo(env, repo)
          ws.send(JSON.stringify({ type: 'repo:classify:result', payload: { category } }))
          break
        }

        default:
          ws.send(JSON.stringify({
            type: 'error',
            payload: { detail: `unknown type: ${msg.type}` }
          }))
      }
    } catch (err: any) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { detail: err.message || 'unknown error' }
      }))
    }
  })

  ws.addEventListener('close', () => {
    console.log('ws: client disconnected')
  })
}

const CATEGORIES = [
  { id: 'junk', desc: 'dead, archived, demo, fork with no changes' },
  { id: 'tool', desc: 'useful library, framework, CLI tool, package' },
  { id: 'learning', desc: 'tutorial, awesome-list, book, course materials' },
  { id: 'longterm', desc: 'actively maintained, large community, worth following' },
  { id: 'app', desc: 'complete application, product, service' }
]

async function classifyRepo(env: Env, repo: any): Promise<string> {
  const prompt = `Analyze this GitHub repository and classify it into one category.

Categories:
${CATEGORIES.map(c => `- ${c.id}: ${c.desc}`).join('\n')}

Repository:
Name: ${repo.full_name || 'unknown'}
Description: ${repo.description || ''}
Language: ${repo.language || ''}
Topics: ${(repo.topics || []).join(', ')}
Stars: ${repo.stargazers_count || 0}
Archived: ${repo.archived || false}

Reply with ONLY the category name: ${CATEGORIES.map(c => c.id).join(', ')}

Category:`

  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt,
    max_tokens: 10,
    temperature: 0.1
  })

  const text = (result.response || '').trim().toLowerCase()
  for (const cat of CATEGORIES) {
    if (text.includes(cat.id)) return cat.id
  }
  return 'tool' // fallback
}