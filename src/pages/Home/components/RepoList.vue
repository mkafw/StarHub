<template>
  <div class="repo-list">
    <div class="repo-list-header">
      <div class="header-left">
        <el-button
          v-if="!selectMode"
          size="small"
          @click="enterSelectMode"
          type="primary"
          plain
        >
          <el-icon><Check /></el-icon>
          <span style="margin-left: 4px;">{{ t('common.select') }}</span>
        </el-button>
        <el-checkbox
          v-if="selectMode"
          v-model="selectAll"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          style="margin-right: 12px;"
        />
        <div class="repo-count">
          <template v-if="selectMode && selectedRepos.size > 0">
            {{ selectedRepos.size }} / {{ totalCount }} {{ t('common.selected') }}
          </template>
          <template v-else>
            {{ totalCount }} {{ totalCount === 1 ? t('home.repo') : t('home.repos') }}
          </template>
        </div>
      </div>
      <div class="header-actions" v-if="selectMode">
        <el-button 
          v-if="selectedRepos.size > 0"
          size="small" 
          type="primary"
          @click="handleBatchTag"
        >
          <el-icon><Collection /></el-icon>
          {{ t('batchTag.title') }} ({{ selectedRepos.size }})
        </el-button>
        <el-button size="small" text @click="exitSelectMode">
          <el-icon><Close /></el-icon>
          {{ selectedRepos.size > 0 ? t('common.cancel') : t('common.exit') }}
        </el-button>
      </div>
      <div class="header-actions" v-if="!selectMode">
        <el-button-group size="small">
          <el-button 
            :type="repoStore.viewMode === 'card' ? 'primary' : ''" 
            @click="repoStore.setViewMode('card')"
            title="卡片视图"
          >
            <el-icon><Menu /></el-icon>
          </el-button>
          <el-button 
            :type="repoStore.viewMode === 'list' ? 'primary' : ''" 
            @click="repoStore.setViewMode('list')"
            title="列表视图"
          >
            <el-icon><Operation /></el-icon>
          </el-button>
        </el-button-group>
        <el-divider direction="vertical" />
        <el-dropdown @command="handleSortChange" trigger="click">
          <el-button size="small" text>
            <el-icon><Sort /></el-icon>
            <span style="margin-left: 4px;">{{ sortLabel }}</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="updated" :class="{ 'is-active': sortBy === 'updated' }">
                <el-icon><Clock /></el-icon>
                <span>按更新时间</span>
                <el-icon v-if="sortBy === 'updated'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
              <el-dropdown-item command="stars" :class="{ 'is-active': sortBy === 'stars' }">
                <el-icon><Star /></el-icon>
                <span>按星标数</span>
                <el-icon v-if="sortBy === 'stars'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
              <el-dropdown-item command="created" :class="{ 'is-active': sortBy === 'created' }">
                <el-icon><Calendar /></el-icon>
                <span>按创建时间</span>
                <el-icon v-if="sortBy === 'created'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div class="repo-list-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton
          v-for="i in 5"
          :key="i"
          :rows="3"
          animated
          class="repo-skeleton"
        />
      </div>
      <div v-else-if="repos.length === 0" class="empty-state">
        <el-icon :size="64" class="empty-icon"><Box /></el-icon>
        <p>{{ t('home.noRepos') }}</p>
      </div>
      <div v-else class="repo-items" :class="repoStore.viewMode">
        <RepoCard
          v-for="repo in sortedRepos"
          :key="`repo-${repo.id}`"
          :repo="repo"
          :viewMode="repoStore.viewMode"
          :isActive="activeRepo?.id === repo.id"
          :selected="selectedRepos.has(repo.id)"
          :selectMode="selectMode"
          @click="handleRepoClick(repo)"
          @select="handleRepoSelect(repo.id, $event)"
        />
      </div>
    </div>
    <div v-if="!loading && repos.length > 0 && totalPages > 1" class="repo-list-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="totalCount"
        :page-sizes="[50, 100, 200, 500]"
        layout="sizes, prev, pager, next"
        :pager-count="5"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        class="repo-pagination"
      />
    </div>

    <!-- 批量设置分类对话框 -->
    <BatchTagDialog
      v-model="showBatchTagDialog"
      :repo-count="selectedRepos.size"
      :tags="tagStore.tags"
      @confirm="handleBatchTagConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'
import { ElMessage, ElMessageBox } from 'element-plus'
import RepoCard from './RepoCard.vue'
import BatchTagDialog from './BatchTagDialog.vue'
import type { Repository } from '@/types'
import { Box, Collection, Close, Check, Sort, Clock, Star, Calendar, Menu, Operation } from '@element-plus/icons-vue'

const props = defineProps<{
  repos: Repository[]
  loading: boolean
  syncing?: boolean
  activeRepo?: Repository | null
}>()

const emit = defineEmits<{
  repoClick: [repo: Repository]
}>()

const { t } = useI18n()
const repoStore = useRepoStore()
const tagStore = useTagStore()
// const syncProgress = computed(() => repoStore.syncProgress)

// 批量选择相关
const selectedRepos = ref<Set<number>>(new Set())
const selectMode = ref(false)
const showBatchTagDialog = ref(false)

// 排序相关
const sortBy = ref<'updated' | 'stars' | 'created'>('updated')

const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'updated':
      return '按更新时间'
    case 'stars':
      return '按星标数'
    case 'created':
      return '按创建时间'
    default:
      return '排序'
  }
})

const handleSortChange = (command: 'updated' | 'stars' | 'created') => {
  sortBy.value = command
}

const sortedRepos = computed(() => {
  const reposCopy = [...props.repos]
  
  switch (sortBy.value) {
    case 'stars':
      return reposCopy.sort((a, b) => b.stargazers_count - a.stargazers_count)
    case 'created':
      return reposCopy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'updated':
    default:
      return reposCopy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }
})

const selectAll = computed({
  get: () => props.repos.length > 0 && selectedRepos.value.size === props.repos.length,
  set: (value: boolean) => {
    if (value) {
      props.repos.forEach(repo => selectedRepos.value.add(repo.id))
    } else {
      selectedRepos.value.clear()
    }
  }
})

const isIndeterminate = computed(() => {
  return selectedRepos.value.size > 0 && selectedRepos.value.size < props.repos.length
})

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    props.repos.forEach(repo => selectedRepos.value.add(repo.id))
  } else {
    props.repos.forEach(repo => selectedRepos.value.delete(repo.id))
  }
}

const handleRepoClick = (repo: Repository) => {
  if (selectMode.value) {
    // 选择模式下，点击切换选择状态
    handleRepoSelect(repo.id, !selectedRepos.value.has(repo.id))
  } else {
    // 普通模式下，触发点击事件
    emit('repoClick', repo)
  }
}

const enterSelectMode = () => {
  selectMode.value = true
}

const exitSelectMode = () => {
  selectedRepos.value.clear()
  selectMode.value = false
}

const handleRepoSelect = (repoId: number, selected: boolean) => {
  if (selected) {
    selectedRepos.value.add(repoId)
  } else {
    selectedRepos.value.delete(repoId)
  }
}

const clearSelection = () => {
  selectedRepos.value.clear()
}

const handleBatchTag = async () => {
  if (selectedRepos.value.size === 0) {
    ElMessage.warning('请先选择仓库')
    return
  }
  
  const tags = tagStore.tags
  if (tags.length === 0) {
    ElMessage.warning(t('batchTag.pleaseCreateTags'))
    return
  }
  
  showBatchTagDialog.value = true
}

const handleBatchTagConfirm = async (selectedTagIds: string[], mode: 'add' | 'replace' = 'add') => {
  if (selectedTagIds.length === 0 && mode === 'replace') {
    // 如果替换模式且没选择任何分类，询问是否移除所有分类
    try {
      await ElMessageBox.confirm(
        '未选择任何分类，将移除所选仓库的所有分类。是否继续？',
        '确认操作',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return // 用户取消
    }
  }
  
  // 批量设置分类到所有选中的仓库
  const repoIds = Array.from(selectedRepos.value)
  const repoCount = repoIds.length
  const tagCount = selectedTagIds.length
  let successCount = 0
  let totalOperations = 0
  
  // 显示进度
  const loadingMessage = ElMessage({
    message: `正在为 ${repoCount} 个仓库${mode === 'add' ? '添加' : '设置'}分类...`,
    type: 'info',
    duration: 0
  })
  
  try {
    for (const repoId of repoIds) {
      try {
        // 获取仓库当前的所有分类
        const currentTags = await tagStore.getRepoTags(repoId)
        const currentTagIds = new Set(currentTags.map(t => t.id))
        
        if (mode === 'replace') {
          // 替换模式：移除不在选中列表中的分类
          for (const tagId of currentTagIds) {
            if (!selectedTagIds.includes(tagId)) {
              await tagStore.removeTagFromRepo(repoId, tagId)
              totalOperations++
            }
          }
        }
        
        // 添加新的分类（如果还没有）
        for (const tagId of selectedTagIds) {
          if (!currentTagIds.has(tagId)) {
            await tagStore.addTagToRepo(repoId, tagId)
            totalOperations++
          }
        }
        
        successCount++
      } catch (error) {
        console.error(`Failed to update tags for repo ${repoId}:`, error)
      }
    }
    
    // 重新加载标签
    await tagStore.loadTags()
    
    loadingMessage.close()
    
    const modeText = mode === 'add' ? '添加' : '设置'
    if (totalOperations > 0) {
      ElMessage.success(`成功为 ${successCount} 个仓库${modeText}了 ${tagCount} 个分类`)
    } else {
      ElMessage.info(`所选仓库已包含这些分类`)
    }
    
    // 清空选择
    clearSelection()
  } catch (error) {
    loadingMessage.close()
    ElMessage.error('批量设置分类失败')
    console.error('Batch tag failed:', error)
  }
}

// Pagination
const currentPage = computed({
  get: () => repoStore.currentPage,
  set: (value: number) => repoStore.setCurrentPage(value)
})

const pageSize = computed({
  get: () => repoStore.pageSize,
  set: (value: number) => repoStore.setPageSize(value)
})

const totalCount = computed(() => {
  // Calculate total count from allFilteredRepos
  const allRepos = (repoStore as any).allFilteredRepos || []
  console.log('Total filtered repos:', allRepos.length)
  return allRepos.length
})

const totalPages = computed(() => {
  const pages = Math.ceil(totalCount.value / pageSize.value)
  console.log('Total pages:', pages, 'pageSize:', pageSize.value)
  return pages
})

const handlePageChange = (page: number) => {
  repoStore.setCurrentPage(page)
  // Scroll to top of list
  const listContent = document.querySelector('.repo-list-content')
  if (listContent) {
    listContent.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const handleSizeChange = (size: number) => {
  repoStore.setPageSize(size)
}
</script>

<style lang="scss" scoped>
.repo-list {
  width: 480px;
  min-width: 400px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: 1px solid var(--border);

  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #1c2333 !important;
    border-right-color: rgba(96, 165, 250, 0.2) !important;
  }

  @media (max-width: 1200px) {
    width: 420px;
  }
  
  @media (max-width: 1024px) {
    width: 360px;
    min-width: 320px;
  }

  @media (max-width: 768px) {
    width: 100%;
    border-right: none;
  }
}

.repo-list-header {
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.2) !important;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex: 1;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-shrink: 0;
  }
  
  :deep(.el-button) {
    font-size: 0.875rem;
    
    &.is-plain {
      background-color: rgba(64, 158, 255, 0.1) !important;
      border-color: #409EFF !important;
      color: #409EFF !important;
      
      &:hover {
        background-color: #409EFF !important;
        color: #fff !important;
        border-color: #409EFF !important;
      }
      
      :deep(.el-icon) {
        color: inherit !important;
      }
    }
    
    &.is-text {
      color: var(--text-primary) !important;
      
      &:hover {
        color: var(--el-color-primary) !important;
        background-color: var(--bg-tertiary) !important;
      }
    }
  }
  
  :deep(.el-checkbox) {
    .el-checkbox__label {
      font-size: 0.875rem;
      color: var(--text-primary);
    }
  }
}

.repo-count {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.repo-syncing {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: 0.875rem;
  color: var(--text-secondary);
  
  .is-loading {
    animation: rotating 2s linear infinite;
  }
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.repo-list-content {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-sm;
}

.repo-list-pagination {
  padding: $spacing-sm $spacing-md;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-top-color: rgba(96, 165, 250, 0.2) !important;
  }
  
  :deep(.el-pagination) {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    white-space: nowrap;
    
    // 总数
    .el-pagination__total {
      color: var(--text-secondary) !important;
      font-size: 13px;
    }
    
    // 每页条数选择器
    .el-pagination__sizes {
      .el-select {
        width: 100px;
        
        .el-input {
          .el-input__wrapper {
            background-color: var(--bg-tertiary) !important;
            box-shadow: 0 0 0 1px var(--border) inset !important;
            
            &:hover {
              box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
            }
          }
          
          .el-input__inner {
            color: var(--text-primary) !important;
            background-color: transparent !important;
            font-size: 13px;
          }
          
          .el-input__suffix {
            .el-icon {
              color: var(--text-secondary) !important;
            }
          }
        }
      }
    }
    
    // 上一页/下一页按钮
    .btn-prev,
    .btn-next {
      background: var(--bg-primary) !important;
      color: var(--text-primary) !important;
      border: 1px solid var(--border) !important;
      min-width: 28px;
      height: 28px;
      
      &:hover:not(:disabled) {
        color: var(--el-color-primary) !important;
        border-color: var(--el-color-primary) !important;
      }
      
      &:disabled {
        color: var(--text-tertiary) !important;
        opacity: 0.5;
      }
    }
    
    // 页码
    .el-pager {
      li {
        background: var(--bg-primary) !important;
        color: var(--text-primary) !important;
        border: 1px solid var(--border) !important;
        min-width: 28px;
        height: 28px;
        line-height: 26px;
        font-size: 13px;
        margin: 0 2px;
        
        &:hover {
          color: var(--el-color-primary) !important;
          border-color: var(--el-color-primary) !important;
        }
        
        &.is-active {
          background: var(--el-color-primary) !important;
          color: #fff !important;
          border-color: var(--el-color-primary) !important;
        }
        
        // 省略号
        &.more {
          background: transparent !important;
          border: none !important;
          color: var(--text-secondary) !important;
        }
      }
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
}

.repo-skeleton {
  padding: $spacing-md;
  background: var(--bg-secondary);
  border-radius: $radius-md;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);

  .empty-icon {
    margin-bottom: $spacing-md;
    opacity: 0.5;
  }

  p {
    font-size: 0.9rem;
  }
}

.repo-items {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  
  &.is-active {
    color: var(--el-color-primary);
    font-weight: 500;
  }
  
  .check-icon {
    margin-left: auto;
    color: var(--el-color-primary);
  }
}
</style>

