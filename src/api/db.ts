import backendHttp from './backend'
import type { Tag } from '@/types'

export const dbApi = {
  // Tags
  getTags(): Promise<Tag[]> {
    return backendHttp.get('/tags').then(res => res.data)
  },

  createTag(tag: Tag): Promise<void> {
    return backendHttp.post('/tags', tag)
  },

  updateTag(tag: Tag): Promise<void> {
    return backendHttp.put('/tags', tag)
  },

  deleteTag(id: string): Promise<void> {
    return backendHttp.delete(`/tags?id=${id}`)
  },

  // Relationship
  addTagToRepo(repoId: number, tagId: string): Promise<void> {
    return backendHttp.post('/repoTags', { repoId, tagId })
  },

  removeTagFromRepo(repoId: number, tagId: string): Promise<void> {
    return backendHttp.delete(`/repoTags?repoId=${repoId}&tagId=${tagId}`)
  },

  // Bulk Sync
  sync(data: { tags: any[], repoTags: any[] }): Promise<any> {
    return backendHttp.post('/sync', data)
  }
}
