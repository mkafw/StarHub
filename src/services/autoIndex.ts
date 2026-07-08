/**
 * StarHub 自动索引 + 智能分类系统
 *
 * - 自动为新同步的仓库生成 embedding
 * - AI 分类：junk / tool / learning / longterm / app
 * - 定时检查新星标
 */

import { wsClient } from './websocket'
import { db } from '@/db'
import type { Repository, RepoCategory } from '@/types'

// ── AI 仓库分类 ─────────────────────────────────────────

let pendingClassify: ((cat: RepoCategory) => void) | null = null

wsClient.on('repo:classify:result', (data: any) => {
  if (pendingClassify && data.category) {
    pendingClassify(data.category as RepoCategory)
    pendingClassify = null
  }
})

/**
 * 通过 WebSocket 请求 Worker 对仓库进行 AI 分类
 */
export function classifyRepo(repo: Repository): Promise<RepoCategory> {
  return new Promise((resolve, reject) => {
    pendingClassify = resolve
    wsClient.send('repo:classify', {
      repo: {
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        topics: repo.topics || [],
        stargazers_count: repo.stargazers_count,
        archived: repo.archived,
      },
    })
    setTimeout(() => {
      if (pendingClassify) {
        pendingClassify = null
        reject(new Error('classify timeout'))
      }
    }, 15000)
  })
}

// ── 预设分类标签 (用于写入 tagStore) ────────────────────

export const CATEGORY_META: Record<RepoCategory, { name: string; nameEn: string; emoji: string; color: string }> = {
  junk:     { name: '垃圾项目',     nameEn: 'Junk',          emoji: '🗑️',  color: '#9e9e9e' },
  tool:     { name: '工具库',       nameEn: 'Tool/Library',  emoji: '🛠️',  color: '#42b883' },
  learning: { name: '学习资源',     nameEn: 'Learning',      emoji: '📚',  color: '#ff9800' },
  longterm: { name: '长期关注',     nameEn: 'Long-term',     emoji: '🚀',  color: '#409eff' },
  app:      { name: '应用产品',     nameEn: 'Application',   emoji: '📱',  color: '#9c27b0' },
}

// ── 批量分类 ─────────────────────────────────────────────

/**
 * 对所有未分类的仓库执行 AI 分类
 * 自动创建对应的 tag 并建立关联
 */
export async function autoClassifyAllRepos(repos: Repository[], tagStore: any): Promise<number> {
  let classified = 0

  for (const repo of repos) {
    // 跳过已有自定义分类的仓库（保留用户标签）
    const hasUserTag = tagStore.tags.some((t: any) =>
      t.repos?.includes(repo.id) && !Object.keys(CATEGORY_META).includes(t.name)
    )
    if (hasUserTag) continue

    try {
      const category = await classifyRepo(repo)
      const meta = CATEGORY_META[category]

      // 查找或创建对应的 tag
      let tag = tagStore.tags.find((t: any) => t.name === meta.name)
      if (!tag) {
        tag = await tagStore.createTag(meta.name, meta.color, meta.emoji)
      }

      // 关联仓库到 tag
      if (!tag.repos?.includes(repo.id)) {
        await tagStore.updateTag(tag.id, {
          repos: [...(tag.repos || []), repo.id],
        })
      }

      classified++
    } catch (err) {
      console.warn(`[autoIndex] classify failed for ${repo.full_name}:`, err)
    }
  }

  return classified
}

// ── 自动索引 ─────────────────────────────────────────────

/**
 * 为新同步的仓库生成 embedding 和分类标签
 */
export async function autoIndexNewRepos(repos: Repository[], tagStore: any): Promise<void> {
  const newRepos: Repository[] = []

  for (const repo of repos) {
    const existing = await db.repoEmbeddings.get(repo.id)
    if (!existing) {
      newRepos.push(repo)
    }
  }

  if (newRepos.length === 0) return

  console.log(`[autoIndex] indexing ${newRepos.length} new repos...`)

  // 生成 embedding
  const { indexRepo } = await import('./semanticSearch')
  for (const repo of newRepos) {
    await indexRepo(repo)
  }

  // AI 分类
  await autoClassifyAllRepos(newRepos, tagStore)
}