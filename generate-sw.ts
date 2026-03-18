import { generateSW } from 'workbox-build'

const result = await generateSW({
  swDest: 'dist/sw.js',
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff2}'],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  skipWaiting: true,
  clientsClaim: true,
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
})

console.log(`SW generated: ${result.count} files precached, ${result.size} bytes`)
