<template>
  <div class="home-page">
    <HomeLayout>
      <template #sidebar>
        <SideMenu />
      </template>
      <template #main>
        <div class="home-content">
          <div class="repo-list-wrapper" :style="{ width: repoListWidth + 'px' }">
            <RepoList
              :repos="filteredRepos"
              :loading="loading"
              :syncing="syncing"
              :activeRepo="selectedRepo"
              @repo-click="handleRepoClick"
            />
          </div>
          <div 
            v-if="selectedRepo"
            class="content-resize-handle"
            @mousedown="startContentResize"
          ></div>
          <div class="detail-wrapper" v-if="selectedRepo">
            <DetailView
              :repo="selectedRepo"
              @close="handleCloseDetail"
            />
          </div>
          <EmptyState v-else />

          <AiChatDialog
            v-model="showAiChat"
            mode="multi"
            :all-repos="repoStore.repos"
          />
        </div>
      </template>
    </HomeLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'
import HomeLayout from '@/layouts/HomeLayout.vue'
import SideMenu from './components/SideMenu.vue'
import RepoList from './components/RepoList.vue'
import DetailView from './components/DetailView.vue'
import EmptyState from './components/EmptyState.vue'
import AiChatDialog from './components/AiChatDialog.vue'
import type { Repository } from '@/types'

const repoStore = useRepoStore()
const tagStore = useTagStore()

const selectedRepo = ref<Repository | null>(null)
const showAiChat = ref(false)

const filteredRepos = computed(() => repoStore.filteredRepos)
const loading = computed(() => repoStore.isFetching)
const syncing = computed(() => repoStore.isSyncing)

// 内容区宽度调整
const repoListWidth = ref(480)
const isContentResizing = ref(false)

const startContentResize = (e: MouseEvent) => {
  isContentResizing.value = true
  document.addEventListener('mousemove', handleContentResize)
  document.addEventListener('mouseup', stopContentResize)
  e.preventDefault()
}

const handleContentResize = (e: MouseEvent) => {
  if (!isContentResizing.value) return
  const newWidth = e.clientX - (document.querySelector('.layout-sidebar') as HTMLElement)?.offsetWidth - 4 // 减去侧边栏宽度和拖���条宽度
  // 限制最小宽度 400px，最大宽度 800px
  if (newWidth >= 400 && newWidth <= 800) {
    repoListWidth.value = newWidth
  }
}

const stopContentResize = () => {
  isContentResizing.value = false
  document.removeEventListener('mousemove', handleContentResize)
  document.removeEventListener('mouseup', stopContentResize)
}

const handleRepoClick = (repo: Repository) => {
  selectedRepo.value = repo
}

const handleCloseDetail = () => {
  selectedRepo.value = null
}

onMounted(async () => {
  try {
    // Load repos if not already loaded or if empty
    if (repoStore.repos.length === 0) {
      await repoStore.loadRepos()
    }
    
    // Clean up tags for non-existent repos
    const allRepoIds = new Set(repoStore.repos.map((r: Repository) => r.id))
    await tagStore.washTags(allRepoIds)
  } catch (error) {
    console.error('Error loading repos:', error)
  }
})
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.home-content {
  display: flex;
  height: 100%;
  position: relative;
}

.repo-list-wrapper {
  min-width: 400px;
  max-width: 800px;
  height: 100%;
  flex-shrink: 0;
  
  :deep(.repo-list) {
    width: 100%;
    border-right: none;
  }
}

.content-resize-handle {
  width: 4px;
  background: var(--border);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color $transition-base;
  position: relative;

  &:hover {
    background: var(--el-color-primary);
  }

  &:active {
    background: var(--el-color-primary);
  }

  // 深色模式下的样式
  [data-theme='dark'] & {
    background: rgba(96, 165, 250, 0.2);
    
    &:hover {
      background: rgba(96, 165, 250, 0.5);
    }
    
    &:active {
      background: rgba(96, 165, 250, 0.7);
    }
  }

  @media (max-width: 768px) {
    display: none;
  }
}

.detail-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
}
</style>

