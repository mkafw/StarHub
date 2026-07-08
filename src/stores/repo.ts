import { defineStore } from 'pinia'
import type { Repository } from '@/types'
import { db } from '@/db'
import { githubApi } from '@/api/github'
import { getPageFromLinkStr } from '@/utils'
import { useTagStore } from './tag'
import { wsClient } from '@/services/websocket'
import Dexie from 'dexie'

export const useRepoStore = defineStore('repo', {
  state: () => ({
    repos: [] as Repository[],
    loading: false,
    isFetching: true,
    isSyncing: false,
    currentSyncId: 0, // Track current sync session
    syncProgress: {
      current: 0,
      total: 0,
      count: 0
    },
    filterType: 'all' as 'all' | 'untagged',
    searchQuery: '',
    selectedLanguage: null as string | null,
    selectedTag: null as string | null,
    // View mode
    viewMode: (localStorage.getItem('view_mode') as 'card' | 'list') || 'card',
    // Pagination
    currentPage: 1,
    pageSize: 50
  }),

  getters: {
    // All filtered repos (without pagination)
    allFilteredRepos(): Repository[] {
      let result = this.repos

      // Filter by type (all or untagged)
      if (this.filterType === 'untagged') {
        result = this.untaggedRepos
      }

      // Filter by tag
      if (this.selectedTag) {
        const tagStore = useTagStore()
        const tag = tagStore.tags.find((t: any) => t.id === this.selectedTag)
        if (tag && tag.repos && Array.isArray(tag.repos)) {
          const tagRepoIds = new Set(tag.repos)
          result = result.filter((repo: Repository) => tagRepoIds.has(repo.id))
        }
      }

      // Filter by language
      if (this.selectedLanguage) {
        result = result.filter((repo: Repository) => repo.language === this.selectedLanguage)
      }

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        result = result.filter(
          (repo: Repository) =>
            repo.name.toLowerCase().includes(query) ||
            repo.full_name.toLowerCase().includes(query) ||
            repo.description?.toLowerCase().includes(query) ||
            repo.owner.login.toLowerCase().includes(query)
        )
      }

      return result
    },

    // Paginated repos for display
    filteredRepos(): Repository[] {
      const allRepos = this.allFilteredRepos
      const start = (this.currentPage - 1) * this.pageSize
      const end = start + this.pageSize
      return allRepos.slice(start, end)
    },

    // Total count and pages
    totalFilteredCount(): number {
      return this.allFilteredRepos.length
    },

    totalPages(): number {
      return Math.ceil(this.totalFilteredCount / this.pageSize)
    },

    untaggedRepos(): Repository[] {
      // Access tag store via this
      const tagStore = useTagStore()
      const taggedIds = new Set<number>()
      if (tagStore.tags && Array.isArray(tagStore.tags)) {
        tagStore.tags.forEach((tag: any) => {
          if (tag.repos && Array.isArray(tag.repos)) {
            tag.repos.forEach((repoId: number) => taggedIds.add(repoId))
          }
        })
      }
      return this.repos.filter(repo => !taggedIds.has(repo.id))
    },

    languages(): string[] {
      const langSet = new Set<string>()
      this.repos.forEach((repo: Repository) => {
        if (repo.language) {
          langSet.add(repo.language)
        }
      })
      return Array.from(langSet).sort()
    }
  },

  actions: {
    async loadRepos(skipLocalLoad = false) {
      // Prevent multiple simultaneous syncs
      if (this.$state.isSyncing) {
        return
      }
      
      // Set sync state
      this.$state.isSyncing = true
      this.$state.isFetching = true
      this.$state.syncProgress = { current: 0, total: 0, count: 0 }

      // Notify WebSocket about sync start
      try { wsClient.send('sync:start', { total: 0 }) } catch {}
      
      // Create a unique sync ID to track this sync session
      const syncId = Date.now()
      this.$state.currentSyncId = syncId
      
      try {
        const allReposMap = new Map<number, Repository>()
        
        // Load from IndexedDB first (unless explicitly skipped)
        if (!skipLocalLoad) {
          const localRepos = await db.repos.toArray()
          this.$state.repos = localRepos || []
          
          // Initialize map with local repos
          localRepos.forEach((repo: Repository) => {
            allReposMap.set(repo.id, repo)
          })
        } else {
          // When skipping local load, start with empty state
          this.$state.repos = []
        }
        
        // Helper function to sanitize repo data for IndexedDB
        const sanitizeRepo = (repo: any): Repository => {
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            open_issues_count: repo.open_issues_count,
            updated_at: repo.updated_at,
            created_at: repo.created_at,
            pushed_at: repo.pushed_at,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
              html_url: repo.owner.html_url
            },
            topics: repo.topics || [],
            archived: repo.archived || false,
            disabled: repo.disabled || false,
            private: repo.private || false
          }
        }
        
        const patch = (repoRes: any) => {
          // Check if this sync session is still valid
          if (this.$state.currentSyncId !== syncId) {
            return false
          }
          
          const reposData = repoRes.data || []
          reposData.forEach((repo: any) => {
            // Sanitize data before storing
            const cleanRepo = sanitizeRepo(repo)
            allReposMap.set(cleanRepo.id, cleanRepo)
          })
          
          // Only update count for progress display
          this.$state.syncProgress.count = allReposMap.size
          return true
        }
        
        // Aggressive queue-based save to minimize DB operations during sync
        let pendingSave = false
        let needsSave = false
        let lastSaveTime = 0
        const SAVE_INTERVAL = 5000 // Save at most once every 5 seconds
        
        const queueSave = async () => {
          const now = Date.now()
          if (now - lastSaveTime < SAVE_INTERVAL && needsSave) {
            return // Skip if saved recently
          }
          
          needsSave = true
          if (pendingSave) return
          
          pendingSave = true
          while (needsSave) {
            needsSave = false
            try {
              const repos = Array.from(allReposMap.values())
              await db.repos.bulkPut(repos)
              lastSaveTime = Date.now()
            } catch (error) {
              console.error('Error saving repos:', error)
            }
          }
          pendingSave = false
        }
        
        // Update UI much less frequently to avoid blocking
        let batchesSinceUpdate = 0
        const UPDATE_INTERVAL = 5 // Update UI every 5 batches (10 pages, 1000 repos)
        
        const updateReposFromMap = (force = false) => {
          batchesSinceUpdate++
          if (!force && batchesSinceUpdate < UPDATE_INTERVAL) {
            return
          }
          
          batchesSinceUpdate = 0
          
          // Only update repos array, don't trigger computed properties
          const updateRepos = () => {
            // Check if this sync is still the current one
            if (this.$state.currentSyncId === syncId) {
              // Update repos from map
              this.$state.repos = Array.from(allReposMap.values())
            }
          }
          
          try {
            if (force) {
              // Force immediate update at the end
              updateRepos()
              // Force save at the end
              needsSave = true
              lastSaveTime = 0 // Reset to allow immediate save
              queueSave()
            } else {
              // Use setTimeout to avoid blocking during sync
              setTimeout(updateRepos, 0)
              // Queue save (with throttling)
              queueSave()
            }
          } catch (error) {
            console.error('Error updating repos:', error)
          }
        }

        // Get first page
        const firstPageRes = await githubApi.getLoginUserStarred(100, 1)
        const shouldContinue = patch(firstPageRes)
        if (!shouldContinue) {
          this.$state.isFetching = false
          this.$state.isSyncing = false
          this.$state.currentSyncId = 0
          return
        }
        this.$state.isFetching = false

        // Get total page count from Link header
        const linkHeader = firstPageRes.headers?.link || firstPageRes.headers?.['link']
        if (!linkHeader) {
          // Only one page or no pagination info
          updateReposFromMap(true)
          this.$state.isSyncing = false
          this.$state.currentSyncId = 0
          return
        }

        const pageCount = getPageFromLinkStr(linkHeader)
        this.$state.syncProgress.total = pageCount
        
        if (!pageCount || pageCount <= 1) {
          // Only one page
          this.$state.syncProgress.current = 1
          updateReposFromMap(true)
          this.$state.isSyncing = false
          this.$state.currentSyncId = 0
          return
        }

        const freshRepoRes = [firstPageRes]
        this.$state.syncProgress.current = 1
        let page = 2

        // Fetch remaining pages in batches
        while (page <= pageCount) {
          // Check if sync was cancelled
          if (this.$state.currentSyncId !== syncId) {
            this.$state.isSyncing = false
            this.$state.isFetching = false
            this.$state.currentSyncId = 0
            return
          }
          
          const limit = 2
          let remainPages = pageCount - page
          let count = remainPages >= limit ? limit : remainPages + 1
          const plist = []
          
          while (count--) {
            plist.push(githubApi.getLoginUserStarred(100, page++))
          }
          
          try {
            const resList = await Promise.all(plist)
            
            // Check again after async operation
            if (this.$state.currentSyncId !== syncId) {
              this.$state.isSyncing = false
              this.$state.isFetching = false
              this.$state.currentSyncId = 0
              return
            }
            
            for (const res of resList) {
              const shouldContinue = patch(res)
              if (!shouldContinue) {
                this.$state.isSyncing = false
                this.$state.isFetching = false
                this.$state.currentSyncId = 0
                return
              }
              freshRepoRes.push(res)
            }
            
            // Update repos periodically (not every batch)
            updateReposFromMap()
            this.$state.syncProgress.current = page - 1
            try { wsClient.send('sync:progress', { current: page - 1, total: pageCount }) } catch {}
          } catch (error) {
            console.error('Error fetching page batch:', error)
            // Continue with what we have
            break
          }
        }

        // Final update after all pages are fetched
        // Force final update
        updateReposFromMap(true)

        // Mark sync as complete
        this.$state.isSyncing = false
        this.$state.currentSyncId = 0
        try { wsClient.send('sync:done', { count: allReposMap.size }) } catch {}

        // Trigger auto-indexing for new repos (non-blocking)
        this.autoIndexAfterSync()

        // Clean up tags for non-existent repos (will be called from component to avoid circular dependency)
      } catch (error: any) {
        console.error('Failed to load repos:', error)
        // Always reset sync state on error
        this.$state.isFetching = false
        this.$state.isSyncing = false
        this.$state.currentSyncId = 0
        
        // Handle QuotaExceededError or DatabaseClosedError caused by QuotaExceededError
        if (error.name === 'QuotaExceededError' || 
            (error.name === 'DatabaseClosedError' && error.message.includes('QuotaExceededError'))) {
          const { ElMessageBox } = await import('element-plus')
          ElMessageBox.confirm(
            '⚠️ 浏览器存储空间已满！\n\n' +
            '这通常是因为数据库损坏或存储配额不足。\n\n' +
            '点击"立即清理"将删除所有本地数据并刷新页面。\n' +
            '或者手动清理：F12 → Application → IndexedDB → 删除 StarHubDB',
            '存储空间不足',
            {
              confirmButtonText: '立即清理',
              cancelButtonText: '稍后处理',
              type: 'error'
            }
          ).then(async () => {
            // Delete database and reload
            try {
              const Dexie = (await import('dexie')).default
              await Dexie.delete('StarHubDB')
              window.location.reload()
            } catch (e) {
              console.error('Failed to delete database:', e)
              alert('自动清理失败，请手动清理：\n1. 按 F12 打开开发者工具\n2. 进入 Application 标签\n3. 删除 IndexedDB 中的 StarHubDB\n4. 刷新页面')
            }
          }).catch(() => {
            // User cancelled
          })
        }
        
        // Re-throw the error so caller knows it failed
        throw error
      } finally {
        // Safety net: ensure sync state is always reset
        // This handles cases where return statements are hit
        if (this.$state.currentSyncId !== syncId) {
          // This sync was cancelled, ensure flags are reset
          this.$state.isSyncing = false
          this.$state.isFetching = false
        }
      }
    },

    setSearchQuery(query: string) {
      this.$state.searchQuery = query
      this.$state.currentPage = 1 // Reset to first page when searching
    },

    setSelectedLanguage(language: string | null) {
      this.$state.selectedLanguage = language
      this.$state.currentPage = 1 // Reset to first page
    },

    setSelectedTag(tagId: string | null) {
      this.$state.selectedTag = tagId
      this.$state.currentPage = 1 // Reset to first page
    },

    setFilterType(type: 'all' | 'untagged') {
      this.$state.filterType = type
      this.$state.currentPage = 1 // Reset to first page
      // Clear tag selection when switching filter type
      if (type === 'all' || type === 'untagged') {
        this.$state.selectedTag = null
      }
    },

    setCurrentPage(page: number) {
      this.$state.currentPage = page
    },

    setPageSize(size: number) {
      this.$state.pageSize = size
      this.$state.currentPage = 1 // Reset to first page
    },

    setViewMode(mode: 'card' | 'list') {
      this.$state.viewMode = mode
      localStorage.setItem('view_mode', mode)
    },

    async clearAndReload() {
      try {
        // Force stop any ongoing sync first
        // Invalidate any ongoing syncs
        this.$state.currentSyncId = 0
        this.$state.isSyncing = false
        this.$state.isFetching = false
        
        // Wait for any ongoing operations to stop (max 2 seconds)
        let waitCount = 0
        const maxWait = 20 // 2 seconds max
        
        while ((this.$state.isSyncing || this.$state.isFetching) && waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waitCount++
          
          // Force check and reset every few iterations
          if (waitCount % 5 === 0) {
            // Force reset if still running
            this.$state.isSyncing = false
            this.$state.isFetching = false
          }
        }
        
        // Final force stop
        this.$state.isSyncing = false
        this.$state.isFetching = false
        
        if (waitCount >= maxWait) {
          console.warn('Force stopped sync (timeout after 2 seconds)')
        }
        
        // Extra wait to ensure everything is settled
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Clear all state immediately
        this.$state.repos = []
        this.$state.selectedTag = null
        this.$state.selectedLanguage = null
        this.$state.filterType = 'all'
        this.$state.searchQuery = ''
        this.$state.currentPage = 1
        this.$state.syncProgress = { current: 0, total: 0, count: 0 }
        
        // Clear tag store state
        const tagStore = useTagStore()
        tagStore.$state.tags = []
        tagStore.$state.loading = false
        
        // Delete the entire database and recreate it
        // Try to close the database gracefully
        try {
          if (db.isOpen()) {
            db.close()
          }
        } catch (e) {
          console.warn('Database was already closed or not open:', e)
        }
        
        // Wait for close to complete
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // First try to clear all tables
        try {
          if (db.isOpen()) {
            await db.repos.clear()
            await db.tags.clear()
            // Clear repoTags table if it exists
            if (db.repoTags) {
              await db.repoTags.clear()
            }
          }
        } catch (error) {
          console.warn('Failed to clear tables, will delete database:', error)
        }
        
        // Delete the entire database with retry logic
        let deleteAttempts = 0
        const maxAttempts = 3
        while (deleteAttempts < maxAttempts) {
          try {
            await Dexie.delete('StarHubDB')
            break
          } catch (error) {
            deleteAttempts++
            console.warn(`Database deletion attempt ${deleteAttempts} failed:`, error)
            if (deleteAttempts >= maxAttempts) {
              throw new Error('Failed to delete database after multiple attempts')
            }
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        // Wait for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Reopen database (Dexie will recreate it with latest schema)
        try {
          await db.open()
        } catch (error) {
          console.error('Failed to reopen database:', error)
          // Try to force a page reload as fallback
          throw new Error('Database recreation failed. Please refresh the page manually.')
        }
        
        // Clear localStorage related data (but preserve important settings)
        const keysToRemove: string[] = []
        Object.keys(localStorage).forEach(key => {
          // Don't remove theme, language, or AI config
          if (!key.includes('theme') && 
              !key.includes('language') && 
              !key.includes('ai_') && 
              !key.includes('category_presets')) {
            if (key.includes('repo') || key.includes('tag') || key.includes('sync')) {
              keysToRemove.push(key)
            }
          }
        })
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        // Reload from GitHub, skip loading from IndexedDB
        await this.loadRepos(true)
      } catch (error) {
        console.error('Failed to clear and reload repos:', error)
        // Reset sync state on error
        this.$state.isSyncing = false
        this.$state.isFetching = false
        throw error
      }
    },

    // ── 自动索引：同步完成后为新仓库生成 embedding ──
    async autoIndexAfterSync() {
      try {
        const { autoIndexNewRepos } = await import('@/services/autoIndex')
        const { useTagStore } = await import('./tag')
        const tagStore = useTagStore()
        await autoIndexNewRepos(this.$state.repos, tagStore)
      } catch (err) {
        console.warn('[autoIndex] background indexing failed:', err)
      }
    }
  }
})

