<template>
  <div class="discover-panel">
    <div class="discover-header">
      <div class="header-left">
        <span class="header-title">{{ t('discover.title') }}</span>
        <el-tag v-if="searchQuery" size="small" type="success" effect="plain" class="query-tag">
          {{ t('discover.searchQuery') }}{{ searchQuery.slice(0, 40) }}...
        </el-tag>
      </div>
      <el-button text circle @click="$emit('close')">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="discover-body">
      <!-- Loading -->
      <div v-if="loading" class="discover-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>{{ t('discover.loading') }}</p>
      </div>

      <!-- Error / No results -->
      <div v-else-if="discoverResults.length === 0" class="discover-empty">
        <el-icon :size="48" color="var(--text-tertiary)"><Search /></el-icon>
        <p>{{ t('discover.noResults') }}</p>
        <p class="hint">{{ t('discover.help') }}</p>
      </div>

      <!-- Results -->
      <div v-else class="discover-list">
        <div
          v-for="repo in discoverResults"
          :key="repo.id"
          class="discover-card"
          @click="$emit('openRepo', repo.html_url)"
        >
          <div class="card-header">
            <span class="repo-name">{{ repo.full_name }}</span>
            <el-tag v-if="repo.language" size="small" effect="plain" class="lang-tag">
              {{ repo.language }}
            </el-tag>
          </div>
          <p class="repo-desc">{{ repo.description || t('repo.noDescription') }}</p>
          <div class="card-meta">
            <span class="meta-item">
              <el-icon><Star /></el-icon>
              {{ repo.stargazers_count > 1000 ? (repo.stargazers_count / 1000).toFixed(1) + 'k' : repo.stargazers_count }}
            </span>
            <span class="meta-item">
              <el-icon><Share /></el-icon>
              {{ repo.forks_count > 1000 ? (repo.forks_count / 1000).toFixed(1) + 'k' : repo.forks_count }}
            </span>
            <el-button
              size="small"
              text
              type="primary"
              class="open-btn"
              @click.stop="$emit('openRepo', repo.html_url)"
            >
              {{ t('discover.openInGithub') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Repository } from '@/types'
import { Close, Loading, Search, Star, Share } from '@element-plus/icons-vue'

const { t } = useI18n()

defineProps<{
  searchQuery: string
  discoverResults: Repository[]
  loading: boolean
}>()

defineEmits<{
  close: []
  openRepo: [url: string]
}>()
</script>

<style lang="scss" scoped>
.discover-panel {
  position: fixed;
  top: 0;
  right: 420px;
  bottom: 0;
  width: 400px;
  z-index: 1000;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease-out;

  [data-theme='dark'] & {
    background: #1c2333;
    border-color: rgba(96, 165, 250, 0.2);
  }
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.discover-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 8px;

  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.2);
  }
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.query-tag {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.discover-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.discover-loading,
.discover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  text-align: center;
  color: var(--text-secondary);

  .hint {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    line-height: 1.5;
    max-width: 300px;
  }
}

.discover-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.discover-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.15);
  }

  &:hover {
    border-color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.04);

    [data-theme='dark'] & {
      background: rgba(96, 165, 250, 0.08);
      border-color: rgba(96, 165, 250, 0.4);
    }
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.repo-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-tag {
  flex-shrink: 0;
}

.repo-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;

  .el-icon {
    font-size: 13px;
  }
}

.open-btn {
  margin-left: auto;
  font-size: 0.75rem;
}
</style>
