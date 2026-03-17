import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/api\/members\/directory$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'directory-data',
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/(www\.gravatar\.com|ui-avatars\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatar-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/api\/auth\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/founders\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'founder-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
