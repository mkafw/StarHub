<template>
  <div class="ai-chat-wrapper">
    <!-- Floating Action Button -->
    <el-tooltip v-if="!panelVisible" :content="t('chat.title')" placement="left">
      <el-button
        class="chat-fab"
        type="primary"
        :icon="ChatDotSquare"
        circle
        size="large"
        @click="openPanel"
      />
    </el-tooltip>

    <!-- Overlay backdrop -->
    <Transition name="panel-fade">
      <div v-if="panelVisible" class="chat-backdrop" @click="closePanel" />
    </Transition>

    <!-- Slide-out Panel -->
    <Transition name="panel-slide">
      <div v-if="panelVisible" class="chat-panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('chat.title') }}</span>
          <el-button text circle @click="closePanel">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <div class="panel-body">
          <!-- AI Not Configured -->
          <div v-if="!aiConfigured" class="no-config">
            <el-icon :size="48" color="var(--text-tertiary)"><WarningFilled /></el-icon>
            <p>{{ t('chat.needAIConfig') }}</p>
            <el-button type="primary" @click="goToSettings">
              {{ t('chat.goToSettings') }}
            </el-button>
          </div>

          <!-- Chat Interface -->
          <div v-else class="chat-interface">
            <div class="message-list" ref="messageListRef" @click="handleMessageClick">
              <div v-if="messages.length === 0" class="greeting">
                {{ mode === 'single' ? t('chat.singleGreeting') : t('chat.multiGreeting') }}
              </div>

              <div
                v-for="(msg, idx) in messages"
                :key="idx"
                :class="['message-bubble', msg.role]"
              >
                <div class="bubble-avatar">
                  <el-icon v-if="msg.role === 'user'"><UserFilled /></el-icon>
                  <el-icon v-else><Cpu /></el-icon>
                </div>
                <div class="bubble-content">
                  <div class="bubble-text" v-html="renderMessage(msg.content)"></div>
                  <div
                    v-if="msg.role === 'assistant' && msg.error"
                    class="bubble-error"
                  >
                    <el-button size="small" text type="danger" @click="retryMessage(idx)">
                      {{ t('chat.retry') }}
                    </el-button>
                  </div>
                  <!-- Repository Interactive Actions -->
                  <div v-if="msg.role === 'assistant' && !isStreaming && detectRepos(msg.content).length > 0" class="bubble-repos">
                    <div v-for="repoName in detectRepos(msg.content)" :key="repoName" class="mini-repo-card">
                      <div class="mini-repo-header">
                        <el-icon><Box /></el-icon>
                        <span class="mini-repo-name">{{ repoName }}</span>
                      </div>
                      <div class="mini-repo-desc" v-if="getRepoByName(repoName)?.description">
                        {{ getRepoByName(repoName)?.description }}
                      </div>
                      <div class="mini-repo-actions">
                        <el-button size="small" type="primary" plain @click="focusRepo(repoName)">
                          {{ t('common.view') }}
                        </el-button>
                        <el-dropdown trigger="click" @command="(tagId: string) => handleTagRepo(repoName, tagId)">
                          <el-button size="small" type="success" plain>
                            {{ t('repo.addTag') }}
                            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                          </el-button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item v-for="tag in tagStore.tags" :key="tag.id" :command="tag.id">
                                <span :style="{ color: tag.color }">{{ tag.emoji }} {{ tag.name }}</span>
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Streaming message -->
              <div v-if="isStreaming" class="message-bubble assistant">
                <div class="bubble-avatar">
                  <el-icon><Cpu /></el-icon>
                </div>
                <div class="bubble-content">
                  <div class="bubble-text">
                    {{ streamBuffer }}<span class="cursor-blink">|</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="input-area">
              <el-input
                v-model="inputText"
                :placeholder="t('chat.inputPlaceholder')"
                type="textarea"
                :rows="2"
                :disabled="isStreaming"
                resize="none"
                @keydown.enter.exact.prevent="sendMessage"
              />
              <div class="input-actions">
                <el-button
                  v-if="!isStreaming"
                  type="primary"
                  :disabled="!inputText.trim()"
                  @click="sendMessage"
                >
                  {{ t('chat.send') }}
                </el-button>
                <el-button
                  v-else
                  type="danger"
                  plain
                  @click="stopGeneration"
                >
                  {{ t('chat.stop') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTagStore } from '@/stores/tag'
import { useRepoStore } from '@/stores/repo'
import { isAIConfigured } from '@/config/ai'
import { ElMessage } from 'element-plus'
import {
  getChatConfig,
  buildSingleRepoSysPrompt,
  buildMultiRepoSysPrompt,
  streamChat,
  type ChatMessage
} from '@/services/chat'
import type { Repository } from '@/types'
import {
  ChatDotSquare,
  WarningFilled,
  UserFilled,
  Cpu,
  Close,
  Box,
  ArrowDown
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()
const tagStore = useTagStore()
const repoStore = useRepoStore()

const props = defineProps<{
  modelValue: boolean
  mode: 'single' | 'multi'
  repo?: Repository | null
  readmeContent?: string
  allRepos?: Repository[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'repo-click': [repo: Repository]
}>()

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

const panelVisible = ref(false)
const messages = ref<DisplayMessage[]>([])
const inputText = ref('')
const isStreaming = ref(false)
const streamBuffer = ref('')
const abortController = ref<AbortController | null>(null)
const messageListRef = ref<HTMLElement | null>(null)

const aiConfigured = computed(() => isAIConfigured())

const openPanel = () => {
  panelVisible.value = true
  emit('update:modelValue', true)
}

const closePanel = () => {
  panelVisible.value = false
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  panelVisible.value = val
})

// Repo interaction logic
const detectRepos = (content: string): string[] => {
  if (!props.allRepos) return []
  // Matches "owner/repo" format
  const matches = content.match(/[a-zA-Z0-9-._]+\/[a-zA-Z0-9-._]+/g) || []
  const uniqueMatches = Array.from(new Set(matches))
  // Filter to only include repos we actually have
  return uniqueMatches.filter(name => 
    props.allRepos?.some(r => r.full_name === name)
  )
}

const getRepoByName = (name: string): Repository | undefined => {
  return props.allRepos?.find(r => r.full_name === name)
}

const renderMessage = (content: string): string => {
  if (!content) return ''
  // Escaping HTML to prevent XSS while allowing our own links
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // Linkify repos
  const repos = detectRepos(content)
  repos.forEach(repoName => {
    const escapedName = repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedName}\\b`, 'g')
    html = html.replace(regex, `<span class="repo-link-inline" data-repo="${repoName}">${repoName}</span>`)
  })

  // Basic markdown-like bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  return html
}

const focusRepo = (repoName: string) => {
  const repo = getRepoByName(repoName)
  if (repo) {
    // Focus in main list
    repoStore.setSearchQuery(repoName)
    emit('repo-click', repo)
    // Optional: close panel? Maybe not, user might want to continue chatting
    ElMessage.success(t('chat.focusedRepo', { name: repoName }))
  }
}

const handleTagRepo = async (repoName: string, tagId: string) => {
  const repo = getRepoByName(repoName)
  const tag = tagStore.tags.find(t => t.id === tagId)
  if (repo && tag) {
    try {
      await tagStore.addTagToRepo(repo.id, tagId)
      ElMessage.success(t('chat.taggedSuccess', { repo: repoName, tag: tag.name }))
    } catch (error) {
      ElMessage.error(t('chat.taggedFailed'))
    }
  }
}

const handleMessageClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('repo-link-inline')) {
    const repoName = target.getAttribute('data-repo')
    if (repoName) {
      focusRepo(repoName)
    }
  }
}

function buildSystemPrompt(): string {
  if (props.mode === 'single' && props.repo) {
    return buildSingleRepoSysPrompt(props.repo, props.readmeContent)
  }
  if (props.mode === 'multi' && props.allRepos?.length) {
    return buildMultiRepoSysPrompt(props.allRepos)
  }
  return 'You are a helpful assistant.'
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  const config = getChatConfig()

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''

  const systemPrompt = buildSystemPrompt()
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.value.map(m => ({ role: m.role, content: m.content }))
  ]

  isStreaming.value = true
  streamBuffer.value = ''
  abortController.value = new AbortController()

  await nextTick()
  scrollToBottom()

  try {
    const fullText = await streamChat(
      chatMessages,
      config,
      () => {
        nextTick(() => scrollToBottom())
      },
      abortController.value.signal
    )

    if (fullText) {
      messages.value.push({ role: 'assistant', content: fullText })
    }
    streamBuffer.value = ''
  } catch (err: any) {
    streamBuffer.value = ''
    if (err?.name === 'AbortError') return

    messages.value.push({
      role: 'assistant',
      content: err?.message === 'rate_limit'
        ? 'API rate limit exceeded. Please wait a moment and try again.'
        : t('chat.error'),
      error: true
    })
  } finally {
    isStreaming.value = false
    abortController.value = null
    await nextTick()
    scrollToBottom()
  }
}

function stopGeneration() {
  abortController.value?.abort()
}

function retryMessage(idx: number) {
  if (idx > 0) {
    const prevMsg = messages.value[idx - 1]
    if (prevMsg.role === 'user') {
      messages.value.splice(idx - 1, 2)
      inputText.value = prevMsg.content
      sendMessage()
    }
  }
}

function goToSettings() {
  closePanel()
  router.push('/settings')
}

function scrollToBottom() {
  const el = messageListRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

watch(streamBuffer, () => {
  nextTick(() => scrollToBottom())
})

onBeforeUnmount(() => {
  abortController.value?.abort()
})
</script>

<style lang="scss" scoped>
.ai-chat-wrapper {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 100;
}

.chat-fab {
  width: 48px;
  height: 48px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
}

// Backdrop
.chat-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

// Slide-out panel
.chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  z-index: 1001;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;

  [data-theme='dark'] & {
    background: #1c2333;
    border-color: rgba(96, 165, 250, 0.2);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.2);
  }
}

.panel-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.no-config {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  text-align: center;
  flex: 1;

  p {
    color: var(--text-secondary);
    margin: 0;
  }
}

.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.greeting {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  padding: 24px 16px;
  line-height: 1.6;
}

.message-bubble {
  display: flex;
  gap: 8px;
  padding: 0 12px;

  &.user {
    flex-direction: row-reverse;

    .bubble-content {
      align-items: flex-end;
    }

    .bubble-text {
      background: var(--el-color-primary);
      color: #fff;
      border-radius: 12px 4px 12px 12px;
    }

    .bubble-avatar {
      background: var(--el-color-primary-light-3);
      color: var(--el-color-primary);

      [data-theme='dark'] & {
        background: var(--el-color-primary);
        color: #fff;
      }
    }
  }

  &.assistant {
    .bubble-text {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 4px 12px 12px 12px;
      border: 1px solid var(--border);

      [data-theme='dark'] & {
        background: #252d3d;
        border-color: rgba(96, 165, 250, 0.2);
      }
    }

    .bubble-avatar {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
  }
}

.bubble-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}

.bubble-content {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.bubble-text {
  padding: 8px 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-error {
  margin-top: 4px;
}

.bubble-repos {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-repo-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  [data-theme='dark'] & {
    background: #1c2333;
    border-color: rgba(96, 165, 250, 0.2);
  }
}

.mini-repo-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 0.85rem;
}

.mini-repo-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mini-repo-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

:deep(.repo-link-inline) {
  color: var(--el-color-primary);
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px dashed var(--el-color-primary);
  
  &:hover {
    opacity: 0.8;
  }
}

.cursor-blink {
  animation: blink 0.7s step-end infinite;
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}

.input-area {
  border-top: 1px solid var(--border);
  padding: 12px;
  flex-shrink: 0;

  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.2);
  }
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

// Panel slide transition
.panel-slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-slide-enter-from {
  transform: translateX(100%);
}
.panel-slide-leave-to {
  transform: translateX(100%);
}

// Backdrop fade transition
.panel-fade-enter-active {
  transition: opacity 0.3s ease;
}
.panel-fade-leave-active {
  transition: opacity 0.25s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
}
</style>
