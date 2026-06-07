import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

/** Fires a fire-and-forget PAGE_VIEW to the backend on every client-side
 *  route change so admins can derive visits / repeats / journeys /
 *  engagement. Renders nothing. Only the pathname is sent — never the query
 *  string — so magic-link tokens and other params never reach the events log.
 *  The server resolves the session email (or records NULL for anonymous). */
export function RouteTracker() {
  const { pathname } = useLocation()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    // Skip the no-op re-fire when only the query string changed.
    if (prevPath.current === pathname) return
    const ref = prevPath.current
    prevPath.current = pathname

    void fetch("/api/events/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(ref ? { path: pathname, ref } : { path: pathname }),
    }).catch(() => {
      // Tracking is best-effort; never surface errors to the user.
    })
  }, [pathname])

  return null
}
