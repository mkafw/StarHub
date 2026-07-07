import { defineStore } from 'pinia'
import type { Tag } from '@/types'
import { db } from '@/db'
import { dbApi } from '@/api/db'
import { AuthToken } from '@/utils/auth'

export const useTagStore = defineStore('tag', {
  state: () => ({
    tags: [] as Tag[],
    loading: false,
    cloudLoading: false,
    lastCloudSync: 0
  }),

  getters: {
    tagMap(state): Map<string, Tag> {
      return new Map(state.tags.map((tag: Tag) => [tag.id, tag]))
    }
  },

  actions: {
    async loadTags(forceCloud = false) {
      this.$state.loading = true
      try {
        // ... (database opening logic remains same)
        if (!db.isOpen()) {
          try {
            await db.open()
          } catch (openError: any) {
            // ... (error handling remains same)
            this.$state.tags = []
            this.$state.loading = false
            return
          }
        }
        
        let tags = await db.tags.toArray()
        
        // If local is empty and user is logged in, try to load from cloud
        if ((tags.length === 0 || forceCloud) && AuthToken.exist()) {
          try {
            const cloudTags = await dbApi.getTags()
            if (cloudTags && cloudTags.length > 0) {
              await db.tags.clear()
              await db.tags.bulkAdd(cloudTags)
              tags = cloudTags
            }
          } catch (cloudError) {
            console.error('Failed to load from cloud:', cloudError)
          }
        }

        // 去重：使用 Map 按 id 去重
        const tagMap = new Map<string, Tag>()
        tags.forEach(tag => {
          if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, {
              ...tag,
              emoji: tag.emoji,
              repos: tag.repos || []
            })
          }
        })
        
        this.$state.tags = Array.from(tagMap.values())
        
        // 如果发现重复，清理数据库
        if (tags.length !== this.$state.tags.length) {
          await db.tags.clear()
          if (this.$state.tags.length > 0) {
            await db.tags.bulkAdd(this.$state.tags)
          }
        }
      } catch (error) {
        console.error('Failed to load tags:', error)
        this.$state.tags = []
      } finally {
        this.$state.loading = false
      }
    },

    /**
     * 将本地数据推送到云端 D1
     */
    async pushToCloud() {
      if (!AuthToken.exist()) return
      this.cloudLoading = true
      try {
        const repoTags: { repoId: number, tagId: string }[] = []
        this.tags.forEach(tag => {
          if (tag.repos) {
            tag.repos.forEach(repoId => {
              repoTags.push({ repoId, tagId: tag.id })
            })
          }
        })
        
        await dbApi.sync({
          tags: this.tags.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
            emoji: t.emoji,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt
          })),
          repoTags
        })
        this.lastCloudSync = Date.now()
        return true
      } catch (error) {
        console.error('Push to cloud failed:', error)
        throw error
      } finally {
        this.cloudLoading = false
      }
    },

    async createTag(name: string, color: string = '#409EFF', emoji?: string): Promise<Tag> {
      const tag: Tag = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        color,
        emoji,
        repos: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      try {
        if (!db.isOpen()) await db.open()
        
        const cleanTag = {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          repos: [],
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt
        }
        await db.tags.add(cleanTag)
        this.$state.tags.push(cleanTag)
        
        // Sync to cloud in background
        if (AuthToken.exist()) {
          dbApi.createTag(cleanTag).catch(e => console.warn('Background cloud sync failed:', e))
        }
        
        return cleanTag
      } catch (error) {
        console.error('Failed to create tag:', error)
        throw error
      }
    },

    async updateTag(tagId: string, updates: Partial<Tag>) {
      try {
        if (!db.isOpen()) await db.open()
        
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) throw new Error('Tag not found')

        const updatedTag = {
          ...tag,
          ...updates,
          updatedAt: Date.now()
        }

        const cleanTag = {
          id: updatedTag.id,
          name: updatedTag.name,
          color: updatedTag.color,
          emoji: updatedTag.emoji,
          repos: Array.isArray(updatedTag.repos) ? [...updatedTag.repos] : [],
          createdAt: updatedTag.createdAt,
          updatedAt: updatedTag.updatedAt
        }

        await db.tags.update(tagId, cleanTag)
        
        const index = this.$state.tags.findIndex((t: Tag) => t.id === tagId)
        if (index !== -1) {
          this.$state.tags = [
            ...this.$state.tags.slice(0, index),
            cleanTag,
            ...this.$state.tags.slice(index + 1)
          ]
        }

        // Sync to cloud in background
        if (AuthToken.exist()) {
          dbApi.updateTag(cleanTag).catch(e => console.warn('Background cloud sync failed:', e))
        }
      } catch (error) {
        console.error('Failed to update tag:', error)
        throw error
      }
    },

    async deleteTag(tagId: string) {
      try {
        if (!db.isOpen()) await db.open()
        
        await db.tags.delete(tagId)
        this.$state.tags = this.$state.tags.filter((t: Tag) => t.id !== tagId)

        // Sync to cloud in background
        if (AuthToken.exist()) {
          dbApi.deleteTag(tagId).catch(e => console.warn('Background cloud sync failed:', e))
        }
      } catch (error) {
        console.error('Failed to delete tag:', error)
        throw error
      }
    },

    // ... (other methods follow similar pattern)
    async addTagToRepo(repoId: number, tagId: string) {
      try {
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) return

        if (tag.repos.includes(repoId)) return

        tag.repos.push(repoId)
        tag.updatedAt = Date.now()

        await this.updateAndSaveTags([...this.$state.tags])

        // Cloud sync
        if (AuthToken.exist()) {
          dbApi.addTagToRepo(repoId, tagId).catch(e => console.warn('Cloud sync failed:', e))
        }
      } catch (error) {
        console.error(`Failed to add tag ${tagId} to repo ${repoId}:`, error)
        throw error
      }
    },

    async removeTagFromRepo(repoId: number, tagId: string) {
      try {
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) return

        const index = tag.repos.indexOf(repoId)
        if (index > -1) {
          tag.repos.splice(index, 1)
          tag.updatedAt = Date.now()
          await this.updateAndSaveTags([...this.$state.tags])
          
          // Cloud sync
          if (AuthToken.exist()) {
            dbApi.removeTagFromRepo(repoId, tagId).catch(e => console.warn('Cloud sync failed:', e))
          }
        }
      } catch (error) {
        console.error(`Failed to remove tag ${tagId} from repo ${repoId}:`, error)
        throw error
      }
    },

    async updateAndSaveTags(tags: Tag[]) {
      try {
        if (!db.isOpen()) await db.open()
        
        const cleanTags = tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          repos: Array.isArray(tag.repos) ? [...tag.repos] : [],
          createdAt: tag.createdAt || Date.now(),
          updatedAt: Date.now()
        }))
        
        await db.tags.clear()
        if (cleanTags.length > 0) {
          await db.tags.bulkAdd(cleanTags)
        }
        
        if (db.repoTags) {
          try {
            await db.repoTags.clear()
          } catch (error) {
            console.error('Failed to clear repoTags table:', error)
          }
        }
        
        this.$state.tags = cleanTags
      } catch (error) {
        console.error('Failed to update and save tags:', error)
        if (error instanceof Error && error.name === 'DatabaseClosedError') {
          this.$state.tags = tags
          return
        }
        throw error
      }
    },

    async getRepoTags(repoId: number): Promise<Tag[]> {
      return this.$state.tags.filter((tag: Tag) => tag.repos.includes(repoId))
    },

    async washTags(allRepoIds: Set<number>) {
      // Remove repo IDs that no longer exist
      const freshTags = this.$state.tags.map(tag => ({
        ...tag,
        repos: tag.repos.filter(id => allRepoIds.has(id))
      }))
      await this.updateAndSaveTags(freshTags)
    }
  }
})

