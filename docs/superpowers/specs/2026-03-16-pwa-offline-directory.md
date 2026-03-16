# CPO Connect — Progressive Web App with Offline Directory

**Date:** 2026-03-16
**Status:** Draft
**Depends on:** [Members Area & Render Deployment](2026-03-14-members-area-design.md) (implemented), [Members Enhancements](../../../docs/superpowers/specs/2026-03-16-members-enhancements-design.md) (implemented)

## Overview

Convert CPO Connect into a Progressive Web App (PWA) so authenticated members can install it to their home screen and browse the member directory offline. The landing page and public content remain online-only; offline capability is exclusively for the authenticated members area.

The app is already a React SPA built with Vite, served by Express from `dist/`. This spec adds a web app manifest, service worker, offline data caching, and an auth-gated install prompt — all additive changes with no modifications to existing features.

---

## 1. Web App Manifest

### File: `public/manifest.json`

```json
{
  "name": "CPO Connect",
  "short_name": "CPO Connect",
  "description": "The peer network for senior product leaders",
  "start_url": "/members/directory",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "any",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/pwa-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Branding notes

- `start_url` is `/members/directory` — the most useful offline page. Authenticated users launching the PWA land directly in the directory.
- `theme_color` matches CPO Connect brand blue (`#2563eb`, the `--primary` hsl value in light mode).
- `background_color` is white (light mode default).

### Icon generation

Generate PWA icons from the existing `favicon.svg`:
- `pwa-icon-192.png` — 192x192, solid background
- `pwa-icon-512.png` — 512x512, solid background
- `pwa-icon-maskable-512.png` — 512x512 with safe zone padding (icon content within the inner 80%)

Place all icons in `public/`. Use a tool like `sharp` or `pwa-asset-generator` at build time, or generate once and commit.

### HTML link

Add to `index.html` `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2563eb" />
```

---

## 2. Service Worker

### Approach: `vite-plugin-pwa`

Use [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (wraps Workbox) for automatic service worker generation. This integrates cleanly with the existing Vite build pipeline — no manual Workbox config needed.

```
npm install -D vite-plugin-pwa
```

### Vite config changes (`vite.config.ts`)

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache the app shell (JS, CSS, HTML, images)
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff2}'],
        // Runtime caching rules
        runtimeCaching: [
          {
            // Directory API — network-first with offline fallback
            urlPattern: /\/api\/members\/directory$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'directory-data',
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 days
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Gravatar/UI Avatars — cache-first (avatar images rarely change)
            urlPattern: /^https:\/\/(www\.gravatar\.com|ui-avatars\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatar-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Auth endpoints — network-only (never cache auth responses)
            urlPattern: /\/api\/auth\//,
            handler: 'NetworkOnly',
          },
          {
            // Other API routes — network-only
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // Founder headshots — cache-first (static images)
            urlPattern: /\/founders\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'founder-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: false, // We provide our own manifest.json in public/
    }),
  ],
  // ...existing config
})
```

### Cache strategy summary

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| App shell (JS/CSS/HTML) | **Precache** (Workbox precache manifest) | Hashed filenames, changes on deploy |
| `/api/members/directory` | **NetworkFirst** (5s timeout → cache) | Fresh data when online, cached data when offline |
| `/api/auth/*` | **NetworkOnly** | Auth must never serve stale data |
| `/api/members/profile`, `/api/members/profile/enrich` | **NetworkOnly** | Profile mutations must hit the server |
| Founder headshots (`/founders/*`) | **CacheFirst** | Static images, rarely change |
| Gravatar / UI Avatars | **CacheFirst** | External images, stable |
| Google Fonts | **StaleWhileRevalidate** (Workbox default) | Font files rarely change |

### Service worker registration

`vite-plugin-pwa` with `registerType: 'autoUpdate'` handles registration automatically via a virtual module. No manual `navigator.serviceWorker.register()` needed. The plugin injects the registration script into the built HTML.

On update detection, the new service worker activates immediately (no "refresh" prompt) — appropriate for a small team where silent updates are preferred over update-on-demand UX.

---

## 3. Offline Member Directory

### How it works

1. **First authenticated visit** to `/members/directory`: the app fetches `/api/members/directory` from the network. The service worker's `NetworkFirst` handler caches the 200 response in the `directory-data` cache.
2. **Subsequent online visits**: NetworkFirst fetches fresh data from the server, updates the cache.
3. **Offline visit**: NetworkFirst times out after 5 seconds, serves the cached response. The directory renders from cached data — all member names, roles, orgs, sectors, focus areas, contact info, and avatar URLs are available.
4. **Cache expiry**: Directory cache expires after 7 days. If a member hasn't opened the app in 7 days and goes offline, they'll see an empty directory (gracefully handled by the existing error state in `Directory.tsx`).

### Offline indicators

Add a minimal offline indicator to the members area:

**`src/hooks/useOnlineStatus.ts`** (new file):
```typescript
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  return online
}
```

**`MembersLayout.tsx`**: When offline, show a subtle banner at the top of the members area:
```
"You're offline — showing cached directory data"
```

Use a muted style consistent with existing UI. Banner appears only when `!online` and the user is on a members page. Dismiss on reconnection.

### What works offline

| Feature | Offline? | Notes |
|---------|----------|-------|
| Member directory (browse, search, filter) | Yes | Cached API response + cached avatars |
| Expanded card details | Yes | All data in the cached directory response |
| Profile page | No | Requires fresh DB read |
| Chat insights | No | Data not cached |
| Login/logout | No | Auth is network-only |
| Theme toggle | Yes | localStorage, no network |
| Enrichment | No | Requires Claude API |

### TanStack Query offline support

TanStack Query (already installed) has built-in offline support. When the network request fails and a cached response exists in the service worker cache, the `fetch` call still resolves successfully (the service worker intercepts and returns the cache). From TanStack Query's perspective, the request "succeeded" — no additional configuration needed.

If the service worker cache is also empty (first visit while offline), the fetch fails and TanStack Query's existing error handling in `Directory.tsx` shows "Failed to load member directory."

---

## 4. Auth-Gated Install Prompt

### Problem

The browser's native install prompt appears to all visitors. Public visitors on the landing page shouldn't see it — the PWA is only useful for authenticated members.

### Solution

Intercept the `beforeinstallprompt` event, suppress the native prompt, and show a custom install button only to authenticated members.

**`src/hooks/useInstallPrompt.ts`** (new file):

```typescript
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault() // Suppress native prompt
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function promptInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') setIsInstalled(true)
  }

  return { canInstall: !!deferredPrompt && !isInstalled, isInstalled, promptInstall }
}
```

### Where the install button appears

**Members area only** — in `MembersLayout.tsx` or the Navbar (when authenticated and on a `/members/*` route):

- Show a subtle "Install App" button (e.g., `Download` icon from lucide-react) next to the theme toggle
- Only visible when `canInstall` is true (browser supports install AND user hasn't installed yet)
- On click: call `promptInstall()` which triggers the browser's native install dialog
- After installation: button disappears (`isInstalled` becomes true)

**Not shown on:**
- Landing page (unauthenticated)
- Already-installed PWA (standalone mode detected)

### TypeScript types

`BeforeInstallPromptEvent` is not in the default lib. Add a type declaration:

**`src/types/pwa.d.ts`** (new file):
```typescript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}
```

---

## 5. Express Static Serving

### Current state

`server.ts` serves static files from `dist/` via `express.static`. The service worker file (`sw.js`) and manifest will be in `dist/` after the Vite build.

### Required change

The service worker must be served with the correct headers for browser registration:

```typescript
// Service worker must not be cached by the browser
app.get('/sw.js', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Service-Worker-Allowed', '/')
  next()
})
```

Add this **before** the `express.static` middleware in `server.ts`. This ensures the browser always checks for service worker updates rather than serving a stale cached version.

No other Express changes needed — `manifest.json`, icons, and the service worker file are all static assets served from `dist/`.

---

## 6. Implementation Order

```
1. Generate PWA icons (192, 512, maskable-512)      — asset creation
2. Create manifest.json + update index.html           — static files
3. Add vite-plugin-pwa + configure workbox            — build pipeline
4. Add service worker no-cache header in server.ts    — server
5. Create useOnlineStatus hook + offline banner        — frontend
6. Create useInstallPrompt hook + install button       — frontend
7. Add pwa.d.ts type declarations                      — types
8. Test: install, offline directory, cache refresh     — verification
```

Steps 1-4 are independent of each other. Steps 5-6 are independent of each other but depend on 3 (service worker must exist for offline/install features to work). Step 7 can be done at any point. Step 8 is final verification.

---

## 7. Testing Plan

### Manual testing checklist

- [ ] **Lighthouse PWA audit** passes (manifest valid, SW registered, icons present)
- [ ] **Install prompt**: appears only on `/members/*` routes when authenticated, not on landing page
- [ ] **Install**: clicking "Install App" triggers browser install dialog, app installs to home screen
- [ ] **Standalone mode**: installed app opens without browser chrome, starts at `/members/directory`
- [ ] **Offline directory**: toggle airplane mode after loading directory → search, filter, expand cards all work
- [ ] **Offline banner**: "You're offline" banner appears in members area when disconnected
- [ ] **Online recovery**: re-enable network → banner disappears, fresh data loads on next navigation
- [ ] **Cache refresh**: deploy a change, reload the PWA → new version loads (autoUpdate)
- [ ] **Auth endpoints**: auth requests never served from cache (login, logout, /me all require network)
- [ ] **Theme persistence**: dark/light toggle works offline (localStorage)
- [ ] **Expired cache**: clear SW cache, go offline → directory shows error state gracefully

### Automated

No new unit tests required. The service worker is generated by Workbox (well-tested upstream). The hooks (`useOnlineStatus`, `useInstallPrompt`) are thin wrappers around browser APIs — integration testing via the manual checklist above is more valuable than mocking browser events.

---

## Out of Scope

- **Push notifications** — not needed for MVP; members communicate via Slack
- **Background sync** — no offline mutations (profile edits, enrichment) queued for later
- **Offline profile page** — would require caching the authenticated user's DB profile; deferred
- **Offline chat insights** — large dataset, low value offline
- **Custom update prompt** — using `autoUpdate` (silent) rather than `prompt` (user-facing refresh button)
- **iOS-specific PWA workarounds** — iOS Safari has limited PWA support (no `beforeinstallprompt`). The manifest and service worker still work; the install prompt simply won't appear. Users can manually "Add to Home Screen" from the share menu.
