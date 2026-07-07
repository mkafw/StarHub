import http from './request'
import qs from 'query-string'
import type { AxiosResponse } from 'axios'
import type { User, Repository } from '@/types'

export const githubApi = {
  // Get authenticated user
  getLoginUser(): Promise<AxiosResponse<User>> {
    return http.get('/user')
  },

  // Get user by username
  getUser(userName: string): Promise<AxiosResponse<User>> {
    return http.get(`/users/${userName}`)
  },

  // Get starred repositories for authenticated user
  getLoginUserStarred(
    perPage: number = 40,
    page: number = 1
  ): Promise<AxiosResponse<Repository[]>> {
    return http.get(
      `/user/starred?${qs.stringify({ per_page: perPage, page })}`
    )
  },

  // Get starred repositories for a user
  getUserStarred(
    userName: string,
    perPage: number = 40,
    page: number = 1
  ): Promise<AxiosResponse<Repository[]>> {
    return http.get(
      `/users/${userName}/starred?${qs.stringify({ per_page: perPage, page })}`
    )
  },

  // Get repository README
  getReadme(owner: string, repo: string): Promise<AxiosResponse<string>> {
    return http.get(`/repos/${owner}/${repo}/readme`, {
      headers: {
        Accept: 'application/vnd.github.VERSION.raw'
      }
    })
  },

  // Get repository details
  getRepository(owner: string, repo: string): Promise<AxiosResponse<Repository>> {
    return http.get(`/repos/${owner}/${repo}`)
  },

  // Check if a repository is starred
  checkStarred(owner: string, repo: string): Promise<AxiosResponse<void>> {
    return http.get(`/user/starred/${owner}/${repo}`)
  },

  // Star a repository
  starRepo(owner: string, repo: string): Promise<AxiosResponse<void>> {
    return http.put(`/user/starred/${owner}/${repo}`)
  },

  // Unstar a repository
  unstarRepo(owner: string, repo: string): Promise<AxiosResponse<void>> {
    return http.delete(`/user/starred/${owner}/${repo}`)
  },

  // Watch/Unwatch a repository (Subscription)
  watchRepo(owner: string, repo: string, subscribed: boolean = true): Promise<AxiosResponse<any>> {
    return http.put(`/repos/${owner}/${repo}/subscription`, { subscribed })
  },

  checkWatching(owner: string, repo: string): Promise<AxiosResponse<any>> {
    return http.get(`/repos/${owner}/${repo}/subscription`)
  }
}

