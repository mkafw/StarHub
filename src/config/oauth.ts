/**
 * GitHub OAuth 配置
 * 
 * GitHub OAuth 必须要有 Client ID（这是 GitHub 的安全要求）
 * Client ID 是公开的，可以安全地放在代码中
 * 
 * 获取方式：
 * 1. 访问 https://github.com/settings/developers
 * 2. 点击 "New OAuth App"
 * 3. 填写：
 *    - Application name: StarHub
 *    - Homepage URL: http://localhost:5173
 *    - Authorization callback URL: http://localhost:5173/#/login
 * 4. 复制 Client ID 填入下方
 */

export const GITHUB_OAUTH_CONFIG = {
  CLIENT_ID: 'Ov23liKH9x1DCueWwcud' // 在这里填入你的 GitHub OAuth Client ID
}

