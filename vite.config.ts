import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [
    vue()
    // VitePWA plugin commented out for now to avoid issues
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
    //   },
    //   manifest: {
    //     name: 'Starflare Pro',
    //     short_name: 'Starflare',
    //     description: 'Professional GitHub Stars Management',
    //     theme_color: '#409EFF',
    //     icons: [
    //       {
    //         src: 'pwa-192x192.png',
    //         sizes: '192x192',
    //         type: 'image/png'
    //       },
    //       {
    //         src: 'pwa-512x512.png',
    //         sizes: '512x512',
    //         type: 'image/png'
    //       }
    //     ]
    //   }
    // })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // 使用新的 Sass API，消除 legacy-js-api 警告
        silenceDeprecations: ['legacy-js-api', 'import'], // 静默弃用警告
        additionalData: `@import "@/styles/variables.scss";\n`
      }
    }
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口
    port: 5173, // 使用 Vite 默认端口
    strictPort: false, // 如果端口被占用，自动尝试下一个可用端口
    open: false, // 不自动打开浏览器
    cors: true, // 启用 CORS
    hmr: {
      host: 'localhost', // HMR 使用 localhost
      port: 5173
    },
    // 注意：/api 请求会通过 Cloudflare Workers 处理（部署后）
    // 本地开发时，使用本地服务器（运行 node server/dev-server.js）
    proxy: {
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
        timeout: 30000, // 30秒超时
        ws: false, // 禁用 WebSocket 代理
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('代理错误:', err.message)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`代理请求: ${req.method} ${req.url}`)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`代理响应: ${req.url} -> ${proxyRes.statusCode}`)
          })
        }
      },
      // WebSocket 代理：转发 /ws 到 Rust Worker 本地开发服务器
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true
      }
    }
  },
  build: {
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 更保守的 chunk 分割策略，避免模块初始化顺序问题
          if (id.includes('node_modules')) {
            // 只分离 Element Plus，Vue 相关库保持在一起
            if (id.includes('element-plus')) {
              return 'element-plus'
            }
            // Vue 相关库（包括 vue、vue-router、pinia）打包在一起
            // 这样可以确保它们按正确顺序初始化
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vue-vendor'
            }
            // 其他大型库
            if (id.includes('dexie') || id.includes('marked') || id.includes('highlight.js')) {
              return 'libs'
            }
          }
        }
      }
    }
  }
})

