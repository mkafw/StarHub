export interface User {
  id: number
  login: string
  name?: string
  avatar_url: string
  bio?: string
  html_url: string
  public_repos: number
  followers: number
  following: number
}

export interface Repository {
  id: number
  name: string
  full_name: string
  description?: string
  html_url: string
  language?: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  updated_at: string
  created_at: string
  pushed_at: string
  default_branch?: string
  owner: {
    login: string
    avatar_url: string
    html_url: string
  }
  topics?: string[]
  license?: {
    name: string
    spdx_id: string
  }
  archived: boolean
  disabled: boolean
  private: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
  emoji?: string // Emoji icon for the tag
  repos: number[] // Repository IDs that have this tag
  createdAt: number
  updatedAt: number
}

export interface RepoTag {
  repoId: number
  tagId: string
}

export interface PaginationInfo {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  status: number
  headers?: Record<string, string>
}

export interface RepoEmbedding {
  repoId: number
  vector: Float64Array | number[]
  updatedAt: number
}

export type RepoCategory = 'junk' | 'tool' | 'learning' | 'longterm' | 'app'

export type Theme = 'light' | 'dark'
export type Language = 'zh' | 'en'

