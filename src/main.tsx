import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

// Recover from "deploy-while-tab-open" white screens. After a deploy, an open tab
// still runs the old entry bundle, which lazy-imports chunk hashes the new deploy
// deleted (see src/data/insights/config.ts). The static host returns index.html
// (text/html) for the missing chunk, so Vite fires `vite:preloadError` and the
// lazy route white-screens. We reload to pick up the fresh index.html.
//
// The service worker (generate-sw.ts) precaches index.html + hashed assets, so a
// plain location.reload() can re-serve a STALE index/chunk from the precache and
// fail to recover. We therefore clear Cache Storage and unregister the SW first, so
// the reload is served fresh from the network. main.tsx re-registers the SW on the
// next load, restoring offline support.
//
// A one-shot sessionStorage guard prevents an infinite reload loop: if a chunk is
// genuinely missing (real outage), we reload once, then let the error surface
// instead of reloading forever.
const PRELOAD_ERROR_RELOAD_KEY = 'vitePreloadErrorReloadedAt'

window.addEventListener('vite:preloadError', (event) => {
  const lastReload = Number(sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY) ?? '0')
  if (Date.now() - lastReload < 10_000) {
    // Already auto-reloaded in the last 10s — don't loop. Let the error surface so a
    // real outage isn't masked by an endless reload.
    return
  }

  event.preventDefault()
  sessionStorage.setItem(PRELOAD_ERROR_RELOAD_KEY, String(Date.now()))

  void (async () => {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map((key) => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
    } catch {
      // Best-effort cache busting — reload regardless so the tab still recovers.
    } finally {
      window.location.reload()
    }
  })()
})
