import axios, { AxiosInstance } from 'axios'
import { AuthToken } from '@/utils/auth'

// 用于调用后端 API 的 axios 实例
const backendHttp: AxiosInstance = axios.create({
  baseURL: '/api', 
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 添加请求拦截器，注入 Authorization 头
backendHttp.interceptors.request.use(config => {
  const token = AuthToken.getGithubToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default backendHttp

