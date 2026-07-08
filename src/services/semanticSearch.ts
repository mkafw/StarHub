/**
 * StarHub 语义搜索引擎
 *
 * 通过 WebSocket 调用 Cloudflare Workers AI 生成 embedding，
 * 在浏览器本地做余弦相似度搜索。
 */

import { wsClient } from './websocket'
import { db } from '@/db'
import type { Repository } from '@/types'

// ── Cosine Similarity ────────────────────────────────────

export function cosineSimilarity(a: number[] | Float64Array, b: number[] | Float64Array): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

let pendingEmbed: ((v: number[]) => void) | null = null

// Listen for the WebSocket response once
wsClient.on('search:embed:result', (data: any) => {
  if (pendingEmbed && data.vector) {
    pendingEmbed(data.vector)
    pendingEmbed = null
  }
})

/**
 * 通过 WebSocket 请求 Worker 生成文本的 embedding 向量
 */
export function generateEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    pendingEmbed = resolve
    wsClient.send('search:embed', { text })
    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingEmbed) {
        pendingEmbed = null
        reject(new Error('embedding timeout'))
      }
    }, 10000)
  })
}

/**
 * 为单个仓库生成并存储 embedding
 */
export async function indexRepo(repo: Repository): Promise<void> {
  const text = [repo.name, repo.full_name, repo.description, (repo.topics || []).join(' '), repo.language]
    .filter(Boolean)
    .join(' ')

  if (!text.trim()) return

  try {
    const vector = await generateEmbedding(text)
    await db.repoEmbeddings.put({ repoId: repo.id, vector, updatedAt: Date.now() })
  } catch (err) {
    console.warn(`[semantic] failed to index ${repo.full_name}:`, err)
  }
}

/**
 * 为所有仓库生成 embedding（自动跳过已索引的）
 */
export async function indexAllRepos(repos: Repository[], force = false): Promise<void> {
  for (const repo of repos) {
    if (!force) {
      const existing = await db.repoEmbeddings.get(repo.id)
      if (existing) continue
    }
    await indexRepo(repo)
  }
}

/**
 * 语义搜索：输入自然语言，返回排序后的仓库列表
 */
export async function semanticSearch(query: string, repos: Repository[]): Promise<{ repo: Repository; score: number }[]> {
  if (!query.trim() || repos.length === 0) return []

  try {
    // 生成查询的 embedding
    const qVec = await generateEmbedding(query)

    // 从 IndexedDB 读取所有仓库的向量
    const results: { repo: Repository; score: number }[] = []

    for (const repo of repos) {
      const emb = await db.repoEmbeddings.get(repo.id)
      if (emb) {
        const score = cosineSimilarity(qVec, emb.vector as number[])
        results.push({ repo, score })
      }
    }

    // 按相似度降序排列
    results.sort((a, b) => b.score - a.score)
    return results
  } catch (err) {
    console.error('[semantic] search failed:', err)
    return []
  }
}