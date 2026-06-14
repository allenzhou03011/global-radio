import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // 启用生产模式优化
          hoistStatic: true,
          cacheHandlers: true
        }
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 3000000, // 3MB
        // 让新版 SW 立刻激活、立刻接管所有页面，避免老 Capacitor WebView
        // 长时间不重启导致用户卡在旧 bundle 上（v2.0.6 之前的 BUG 残留）。
        skipWaiting: true,
        clientsClaim: true,
        // 强制 SW 每次 navigation 优先走网络，缓存只作为离线兜底，避免
        // index.html / JS bundle 在用户端无限期缓存。
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // 站点入口和 JS / CSS：网络优先，5s 超时后回退缓存
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24, // 1 天
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.radio-browser\.info\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'radio-api-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 天
              },
            },
          },
        ],
      },
      manifest: {
        name: '全球电台 - GlobalRadio',
        short_name: '全球电台',
        description: '聆听全球高品质电台，享受无限音乐、新闻和娱乐内容',
        theme_color: '#1a365d',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['music', 'entertainment', 'news', 'multimedia'],
        shortcuts: [
          {
            name: '随机播放',
            short_name: '随机',
            description: '播放随机电台',
            url: '/?random=true',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }]
          },
          {
            name: '我的收藏',
            short_name: '收藏',
            description: '查看收藏的电台',
            url: '/favorites',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }]
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    cors: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser'
  }
})
