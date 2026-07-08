/**
 * StarHub Main Worker — 统一入口
 *
 * 路由：
 * - /api/getToken  → GitHub OAuth token exchange
 * - /api/*         → DB operations
 * - /ws            → WebSocket (semantic search + classify)
 */

interface Env {
  CLIENT_ID: string
  CLIENT_SECRET: string
  DB: D1Database
  AI: any
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // ── WebSocket ──
    const upgrade = request.headers.get('Upgrade') || ''
    if (upgrade.toLowerCase() === 'websocket' || pathname === '/ws') {
      return handleWebSocket(request, env)
    }

    // ── OAuth Token ──
    if (pathname === '/api/getToken') {
      return handleGetToken(request, url, env)
    }

    // ── DB API ──
    if (pathname.startsWith('/api/')) {
      return handleDbApi(request, url, env)
    }

    return new Response('Not Found', { status: 404 })
  }
}

// ── WebSocket ─────────────────────────────────────────

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const pair = new WebSocketPair()
  const [client, server] = [pair[0], pair[1]]
  server.accept()
  handleSession(server, env)
  return new Response(null, { status: 101, webSocket: client })
}

async function handleSession(ws: WebSocket, env: Env): Promise<void> {
  ws.addEventListener('message', async (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string)

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', payload: {} }))
          break

        case 'search:embed': {
          const text = msg.payload?.text
          if (!text) {
            ws.send(JSON.stringify({ type: 'error', payload: { detail: 'text is required' } }))
            return
          }
          const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
          const vector = result.data?.[0]?.embedding
          ws.send(JSON.stringify({
            type: 'search:embed:result',
            payload: { vector }
          }))
          break
        }

        case 'repo:classify': {
          const repo = msg.payload?.repo
          if (!repo) {
            ws.send(JSON.stringify({ type: 'error', payload: { detail: 'repo is required' } }))
            return
          }
          const category = await classifyRepo(env, repo)
          ws.send(JSON.stringify({
            type: 'repo:classify:result',
            payload: { category }
          }))
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

  ws.addEventListener('close', () => console.log('ws: client disconnected'))
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
  return 'tool'
}

// ── OAuth Token ───────────────────────────────────────

async function handleGetToken(request: Request, url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code') || ''
  const redirect_uri = url.searchParams.get('redirect_uri') || ''

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const query = `code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(env.CLIENT_ID)}&client_secret=${encodeURIComponent(env.CLIENT_SECRET)}&redirect_uri=${encodeURIComponent(redirect_uri)}`
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: query
    })
    const body: any = await res.json()
    if (!body.access_token) {
      throw new Error(body.error_description || body.error || 'access_token empty')
    }
    const appToken = `app_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return Response.json({
      token: appToken,
      token_type: body.token_type || 'token',
      access_token: body.access_token
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to exchange token', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ── DB API ────────────────────────────────────────────

async function handleDbApi(request: Request, url: URL, env: Env): Promise<Response> {
  // Verify GitHub token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'StarHub-Worker' }
  })
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid GitHub Token' }), { status: 401 })
  }
  const user: any = await userRes.json()
  const userId = user.id
  const pathname = url.pathname
  const method = request.method

  // Tags
  if (pathname === '/api/tags') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY created_at DESC')
        .bind(userId).all()
      const tagsWithRepos = await Promise.all(results.map(async (tag: any) => {
        const { results: repos } = await env.DB.prepare('SELECT repo_id FROM repo_tags WHERE tag_id = ? AND user_id = ?')
          .bind(tag.id, userId).all()
        return { ...tag, repos: repos.map((r: any) => r.repo_id) }
      }))
      return Response.json(tagsWithRepos)
    }
    if (method === 'POST') {
      const body = await request.json<any>()
      await env.DB.prepare('INSERT INTO tags (id, user_id, name, color, emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(body.id, userId, body.name, body.color, body.emoji, body.createdAt || Date.now(), body.updatedAt || Date.now()).run()
      return Response.json({ success: true })
    }
    if (method === 'PUT') {
      const body = await request.json<any>()
      await env.DB.prepare('UPDATE tags SET name = ?, color = ?, emoji = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .bind(body.name, body.color, body.emoji, body.updatedAt || Date.now(), body.id, userId).run()
      return Response.json({ success: true })
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return new Response('Missing ID', { status: 400 })
      await env.DB.batch([
        env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(id, userId),
        env.DB.prepare('DELETE FROM repo_tags WHERE tag_id = ? AND user_id = ?').bind(id, userId)
      ])
      return Response.json({ success: true })
    }
  }

  // Repo-Tag relationships
  if (pathname === '/api/repoTags') {
    if (method === 'POST') {
      const body = await request.json<any>()
      await env.DB.prepare('INSERT OR IGNORE INTO repo_tags (repo_id, tag_id, user_id) VALUES (?, ?, ?)')
        .bind(body.repoId, body.tagId, userId).run()
      return Response.json({ success: true })
    }
    if (method === 'DELETE') {
      const repoId = url.searchParams.get('repoId')
      const tagId = url.searchParams.get('tagId')
      if (!repoId || !tagId) return new Response('Missing parameters', { status: 400 })
      await env.DB.prepare('DELETE FROM repo_tags WHERE repo_id = ? AND tag_id = ? AND user_id = ?')
        .bind(repoId, tagId, userId).run()
      return Response.json({ success: true })
    }
  }

  // Bulk Sync
  if (pathname === '/api/sync' && method === 'POST') {
    const body = await request.json<any>()
    const { tags, repoTags } = body
    const statements: any[] = []
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        statements.push(env.DB.prepare('INSERT OR REPLACE INTO tags (id, user_id, name, color, emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(tag.id, userId, tag.name, tag.color, tag.emoji, tag.createdAt, tag.updatedAt))
      }
    }
    if (repoTags && Array.isArray(repoTags)) {
      const tagIds = [...new Set(repoTags.map((rt: any) => rt.tagId))]
      for (const tid of tagIds) {
        statements.push(env.DB.prepare('DELETE FROM repo_tags WHERE tag_id = ? AND user_id = ?').bind(tid, userId))
      }
      for (const rt of repoTags) {
        statements.push(env.DB.prepare('INSERT OR IGNORE INTO repo_tags (repo_id, tag_id, user_id) VALUES (?, ?, ?)')
          .bind(rt.repoId, rt.tagId, userId))
      }
    }
    if (statements.length > 0) await env.DB.batch(statements)
    return Response.json({ success: true, count: statements.length })
  }

  return new Response('Not Found', { status: 404 })
}