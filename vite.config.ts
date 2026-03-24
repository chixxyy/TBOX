import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // We will use ReloadPrompt.vue
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'TradingBox',
        short_name: 'TradingBox',
        description: 'Modern Crypto & Prediction Market Dashboard',
        theme_color: '#05080f',
        background_color: '#05080f',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/polymarket': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/polymarket/, ''),
        secure: true,
      },
      '/yfinance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yfinance/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        secure: true,
      },
    },
  },
})
