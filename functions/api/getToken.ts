/**
 * Cloudflare Worker for StarHub
 * 处理 API 请求，静态文件由 Assets 自动托管
 */

interface Env {
  CLIENT_ID: string
  CLIENT_SECRET: string
}

async function getToken(
  code: string,
  client_id: string,
  client_secret: string,
  redirect_uri: string
) {
  const query = `code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(client_id)}&client_secret=${encodeURIComponent(client_secret)}&redirect_uri=${encodeURIComponent(redirect_uri)}`
  const url = 'https://github.com/login/oauth/access_token'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: query
  })
  const body = await res.json<any>()
  if (!body.access_token) {
    throw new Error(body.error_description || body.error || 'access_token empty')
  }
  return body
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname
    
    // ========== API 路由 ==========
    if (pathname === '/api/getToken') {
      const code = url.searchParams.get('code') || ''
      const redirect_uri = url.searchParams.get('redirect_uri') || ''
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (!redirect_uri) {
        return new Response(JSON.stringify({ error: 'Missing redirect_uri parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      try {
        const tokenData = await getToken(code, env.CLIENT_ID, env.CLIENT_SECRET, redirect_uri)
        
        // Generate a simple app token
        const appToken = `app_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        return Response.json({
          token: appToken,
          token_type: tokenData.token_type || 'token',
          access_token: tokenData.access_token
        })
      } catch (error: any) {
        console.error('OAuth error:', error)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to exchange token',
            detail: error.message || String(error)
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }
    
    // ========== 其他路径返回 404，让 Assets 处理 ==========
    return new Response('Not Found', { status: 404 })
  }
}