diff --git a/src/components/EventsSection.tsx b/src/components/EventsSection.tsx
index 8a68b0e..c7e240d 100644
--- a/src/components/EventsSection.tsx
+++ b/src/components/EventsSection.tsx
@@ -90,7 +90,7 @@ const EventsSection = () => {
   }, []);
 
   return (
-    <section id="events" className="py-24 sm:py-32">
+    <section className="py-12 sm:py-16">
       <div className="container">
         <motion.div
           className="max-w-2xl mb-16"
diff --git a/src/components/Footer.tsx b/src/components/Footer.tsx
index d08cbda..f8c531c 100644
--- a/src/components/Footer.tsx
+++ b/src/components/Footer.tsx
@@ -18,7 +18,6 @@ const Footer = () => {
           </div>
           <div className="flex items-center gap-6 text-sm text-muted-foreground">
             <a href="/#manifesto" className="hover:text-foreground transition-colors">Manifesto</a>
-            <a href="/#events" className="hover:text-foreground transition-colors">Events</a>
             <a href="/#join" className="hover:text-foreground transition-colors">Join</a>
             <a href="/faq" className="hover:text-foreground transition-colors">FAQ</a>
             <a href="mailto:cpoconnect@googlegroups.com" className="hover:text-foreground transition-colors">Contact</a>
diff --git a/src/components/Navbar.tsx b/src/components/Navbar.tsx
index 929ee26..a2e751a 100644
--- a/src/components/Navbar.tsx
+++ b/src/components/Navbar.tsx
@@ -21,7 +21,6 @@ import logo from "@/assets/logo.png"
 const publicLinks = [
   { label: "Manifesto", href: "#manifesto" },
   { label: "Channels", href: "#channels" },
-  { label: "Events", href: "#events" },
   { label: "Founders", href: "#founders" },
 ]
 
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index 0639a57..18aa12d 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -3,7 +3,6 @@ import HeroSection from "@/components/HeroSection";
 import ManifestoSection from "@/components/ManifestoSection";
 import ChannelsSection from "@/components/ChannelsSection";
 import InfographicSection from "@/components/InfographicSection";
-import EventsSection from "@/components/EventsSection";
 import FoundersSection from "@/components/FoundersSection";
 import JoinSection from "@/components/JoinSection";
 import Footer from "@/components/Footer";
@@ -16,7 +15,6 @@ const Index = () => {
       <ManifestoSection />
       <ChannelsSection />
       <InfographicSection />
-      <EventsSection />
       <FoundersSection />
       <JoinSection />
       <Footer />
diff --git a/src/pages/members/WhatsTalked.tsx b/src/pages/members/WhatsTalked.tsx
index 3ac3ed1..ca66897 100644
--- a/src/pages/members/WhatsTalked.tsx
+++ b/src/pages/members/WhatsTalked.tsx
@@ -23,6 +23,7 @@ import {
   type ChannelScopeValue,
 } from '@/lib/channel-scope-params'
 import { useMemberProfile } from '@/hooks/useMemberProfile'
+import EventsSection from '@/components/EventsSection'
 
 const ASK_STALE_MS = 5 * 60 * 1000
 const TILES_STALE_MS = 60 * 60 * 1000
@@ -283,6 +284,8 @@ export default function WhatsTalked() {
           countdownRemaining={rateLimitWaitSec}
         />
       )}
+
+      <EventsSection />
     </div>
   )
 }
diff --git a/src/test/Index.test.tsx b/src/test/Index.test.tsx
new file mode 100644
index 0000000..5b36176
--- /dev/null
+++ b/src/test/Index.test.tsx
@@ -0,0 +1,74 @@
+// Smoke test: the public landing page must NOT render the Luma events
+// section. EventsSection was relocated to /members/whats-talked.
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { MemoryRouter } from 'react-router-dom'
+
+const { mockUseAuth, mockUseTheme, mockUseInstallPrompt } = vi.hoisted(() => ({
+  mockUseAuth: vi.fn(() => ({
+    user: null,
+    isAuthenticated: false,
+    hasChecked: true,
+    isLoading: false,
+    login: vi.fn(),
+    logout: vi.fn(),
+    checkAuth: vi.fn(),
+  })),
+  mockUseTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
+  mockUseInstallPrompt: vi.fn(() => ({ canInstall: false, promptInstall: vi.fn() })),
+}))
+
+vi.mock('../contexts/AuthContext', () => ({
+  useAuth: mockUseAuth,
+}))
+vi.mock('../contexts/ThemeContext', () => ({
+  useTheme: mockUseTheme,
+}))
+vi.mock('../hooks/useInstallPrompt', () => ({
+  useInstallPrompt: mockUseInstallPrompt,
+}))
+vi.mock('../components/LoginModal', () => ({
+  LoginModal: () => null,
+}))
+
+import Index from '../pages/Index'
+
+function renderIndex() {
+  return render(
+    <MemoryRouter initialEntries={['/']}>
+      <Index />
+    </MemoryRouter>,
+  )
+}
+
+describe('Landing page — events relocation', () => {
+  beforeEach(() => {
+    vi.stubGlobal(
+      'fetch',
+      vi.fn(async () =>
+        new Response(JSON.stringify({}), {
+          status: 200,
+          headers: { 'Content-Type': 'application/json' },
+        }),
+      ),
+    )
+  })
+
+  afterEach(() => {
+    vi.unstubAllGlobals()
+  })
+
+  it('does NOT render the "Meet in person" events heading', () => {
+    renderIndex()
+    expect(
+      screen.queryByRole('heading', { level: 2, name: /Meet in person/i }),
+    ).not.toBeInTheDocument()
+  })
+
+  it('does NOT render an Events nav link on the landing page', () => {
+    renderIndex()
+    expect(
+      screen.queryByRole('link', { name: /^Events$/i }),
+    ).not.toBeInTheDocument()
+  })
+})
diff --git a/src/test/WhatsTalked.test.tsx b/src/test/WhatsTalked.test.tsx
index 187931f..75925f6 100644
--- a/src/test/WhatsTalked.test.tsx
+++ b/src/test/WhatsTalked.test.tsx
@@ -578,6 +578,43 @@ describe('WhatsTalked error handling', () => {
     })
   })
 
+  it('renders the Luma events section beneath the chat surface', async () => {
+    // The events relocation: EventsSection now lives on /members/whats-talked.
+    // Mock /api/events with one fixture event and assert the heading appears.
+    const fixtureEvent = {
+      api_id: 'evt-1',
+      name: 'Test Meetup',
+      url: 'test-meetup',
+      cover_url: null,
+      start_at: '2026-06-15T18:00:00.000Z',
+      timezone: 'Europe/London',
+      location_type: 'offline',
+      city_state: 'London, UK',
+    }
+    vi.stubGlobal(
+      'fetch',
+      vi.fn(async (input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+        if (url.startsWith('/api/members/profile')) {
+          return jsonResponse({})
+        }
+        if (url.startsWith('/api/chat/prompt-tiles')) {
+          return jsonResponse({ current: [], evergreen: [] })
+        }
+        if (url.startsWith('/api/events')) {
+          return jsonResponse({ events: [fixtureEvent] })
+        }
+        throw new Error(`Unexpected fetch: ${url}`)
+      }),
+    )
+    renderPage()
+
+    expect(
+      await screen.findByRole('heading', { level: 2, name: /Meet in person/i }),
+    ).toBeInTheDocument()
+    expect(await screen.findByText('Test Meetup')).toBeInTheDocument()
+  })
+
   it('moves focus to the answer heading on every submission (including same-query resubmit)', async () => {
     vi.stubGlobal(
       'fetch',
