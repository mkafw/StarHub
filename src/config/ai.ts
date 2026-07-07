// AI 配置
export interface AIConfig {
  provider: 'openai' | 'claude' | 'qwen' | 'zhipu' | 'deepseek' | 'gemini' | 'mistral' | 'baishan'
  apiKey: string
  baseURL?: string
  model?: string
  batchSize?: number // 分类批次大小，默认 50
}

// 默认配置
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseURL: '',
  model: '',
  batchSize: 50 // 默认批次大小
}

// 各平台默认模型
export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  qwen: 'qwen-plus',
  zhipu: 'glm-4-flash',
  deepseek: 'deepseek-chat',
  gemini: 'gemini-2.0-flash',
  mistral: 'mistral-small-latest',
  baishan: 'baishan-model'
}

// 各平台默认 API 地址
export const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  mistral: 'https://api.mistral.ai/v1',
  baishan: ''
}

// 从 localStorage 获取 AI 配置
export function getAIConfig(): AIConfig {
  const stored = localStorage.getItem('ai_config')
  if (stored) {
    try {
      const config = JSON.parse(stored)
      // 确保 batchSize 有默认值
      if (!config.batchSize) {
        config.batchSize = DEFAULT_AI_CONFIG.batchSize
      }
      return config
    } catch (e) {
      console.error('Failed to parse AI config:', e)
    }
  }
  return DEFAULT_AI_CONFIG
}

// 保存 AI 配置到 localStorage
export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem('ai_config', JSON.stringify(config))
}

// 检查 AI 配置是否完整
export function isAIConfigured(): boolean {
  const config = getAIConfig()
  return !!config.apiKey && !!config.provider
}

