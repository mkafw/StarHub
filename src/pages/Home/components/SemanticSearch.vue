<template>
  <div class="semantic-search">
    <div class="search-input-wrapper">
      <el-icon class="search-icon"><Search /></el-icon>
      <input
        ref="inputRef"
        v-model="query"
        class="search-input"
        :placeholder="t('home.semanticPlaceholder')"
        @input="onInput"
        @keydown.enter="doSearch"
        @focus="showResults = true"
      />
      <el-button
        v-if="query"
        text
        circle
        size="small"
        class="clear-btn"
        @click="clearSearch"
      >
        <el-icon><Close /></el-icon>
      </el-button>
      <el-button
        v-if="query && !searching"
        type="primary"
        size="small"
        class="search-btn"
        @click="doSearch"
      >
        {{ t('common.search') }}
      </el-button>
      <el-button
        v-if="searching"
        type="info"
        size="small"
        loading
        class="search-btn"
      >
        {{ t('common.loading') }}
      </el-button>
    </div>

    <!-- Search Results Dropdown -->
    <transition name="slide-down">
      <div v-if="showResults && results.length > 0" class="search-results">
        <div class="results-header">
          <span>{{ t('home.semanticResults', { count: results.length }) }}</span>
          <el-button text size="small" @click="showResults = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <div class="results-list">
          <div
            v-for="item in results"
            :key="item.repo.id"
            class="result-item"
            :class="{ active: activeRepo?.id === item.repo.id }"
            @click="selectRepo(item.repo)"
          >
            <div class="result-header">
              <span class="result-name">{{ item.repo.full_name }}</span>
              <span class="result-score" :style="{ color: scoreColor(item.score) }">
                {{ (item.score * 100).toFixed(0) }}%
              </span>
            </div>
            <p v-if="item.repo.description" class="result-desc">{{ item.repo.description }}</p>
            <div class="result-meta">
              <span v-if="item.repo.language" class="result-lang">
                <span class="lang-dot" :style="{ background: getLanguageColor(item.repo.language) }"></span>
                {{ item.repo.language }}
              </span>
              <span class="result-stars">⭐ {{ formatNumber(item.repo.stargazers_count) }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- No results -->
    <transition name="slide-down">
      <div v-if="showResults && searched && results.length === 0 && !searching" class="search-results empty">
        <el-empty :description="t('home.semanticNoResults')" :image-size="60" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Close } from '@element-plus/icons-vue'
import { getLanguageColor } from '@/utils/languageColors'
import { formatNumber } from '@/utils'
import { semanticSearch } from '@/services/semanticSearch'
import type { Repository } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  repos: Repository[]
  activeRepo: Repository | null
}>()

const emit = defineEmits<{
  (e: 'select', repo: Repository): void
}>()

const query = ref('')
const results = ref<{ repo: Repository; score: number }[]>([])
const searching = ref(false)
const showResults = ref(false)
const searched = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const onInput = () => {
  searched.value = false
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  if (query.value.length < 2) {
    results.value = []
    return
  }
  debounceTimer.value = setTimeout(doSearch, 300)
}

const doSearch = async () => {
  if (query.value.length < 2) return
  searching.value = true
  searched.value = true
  showResults.value = true
  try {
    results.value = await semanticSearch(query.value, props.repos)
  } finally {
    searching.value = false
  }
}

const selectRepo = (repo: Repository) => {
  emit('select', repo)
  showResults.value = false
}

const clearSearch = () => {
  query.value = ''
  results.value = []
  searched.value = false
  showResults.value = false
}

const scoreColor = (score: number): string => {
  if (score > 0.6) return '#67c23a'
  if (score > 0.3) return '#e6a23c'
  return '#909399'
}
</script>

<style scoped lang="scss">
.semantic-search {
  position: relative;
  width: 100%;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  padding: 2px 4px;
  transition: all $transition-base;

  &:focus-within {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
  }
}

.search-icon {
  color: var(--text-tertiary);
  font-size: 16px;
  padding: 0 4px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 6px 4px;
  min-width: 0;

  &::placeholder {
    color: var(--text-tertiary);
  }
}

.search-btn {
  flex-shrink: 0;
}

.clear-btn {
  flex-shrink: 0;
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  max-height: 400px;
  overflow: hidden;
  z-index: 1000;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
}

.results-list {
  max-height: 350px;
  overflow-y: auto;
}

.result-item {
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  transition: background $transition-fast;
  border-bottom: 1px solid var(--border);

  &:hover,
  &.active {
    background: var(--bg-tertiary);
  }

  &:last-child {
    border-bottom: none;
  }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
}

.result-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-score {
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
}

.result-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 2px 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-top: 2px;
}

.result-lang,
.result-stars {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.lang-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.search-results.empty {
  padding: $spacing-lg;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>