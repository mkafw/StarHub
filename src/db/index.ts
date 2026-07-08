import Dexie, { Table } from 'dexie'
import type { Repository, Tag, RepoTag, RepoEmbedding } from '@/types'

/**
 * 共享的 Dexie 数据库实例
 * 用于存储 repositories、tags、repoTags 和 repoEmbeddings
 */
class StarHubDatabase extends Dexie {
  repos!: Table<Repository, number>
  tags!: Table<Tag, string>
  repoTags!: Table<RepoTag, [number, string]>
  repoEmbeddings!: Table<RepoEmbedding, number>

  constructor() {
    super('StarHubDB')

    // Version 1 - Initial schema
    this.version(1).stores({
      repos: 'id, full_name, language, updated_at',
      tags: 'id, name, createdAt'
    })

    // Version 2 - Add repoTags table
    this.version(2).stores({
      repos: 'id, full_name, language, updated_at',
      tags: 'id, name, createdAt',
      repoTags: '[repoId+tagId], repoId, tagId'
    })

    // Version 3 - Add repoEmbeddings table
    this.version(3).stores({
      repos: 'id, full_name, language, updated_at',
      tags: 'id, name, createdAt',
      repoTags: '[repoId+tagId], repoId, tagId',
      repoEmbeddings: 'repoId'
    })
  }
}

export const db = new StarHubDatabase()

