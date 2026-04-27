import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

interface User {
  name: string
  email: string
  jobRole: string
  /** Whether the current user is in ADMIN_EMAILS. Defaults to `false`
   *  when /api/auth/me omits the field so pre-Batch-7 responses keep
   *  working. Admin-only UI must treat absence as non-admin. */
  isAdmin: boolean
}

// Login resolves with no membership signal — the server responds with
// the same `{ code: 'check_email' }` shape regardless of lookup result
// to defeat enumeration. Differentiation happens in the inbox (magic
// link vs apply-to-join invite). See dispatch
// dispatch_cpo_magic_link_enumeration_fix_20260427.md.
interface LoginResult {
  code: 'check_email'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  hasChecked: boolean
  login: (email: string) => Promise<LoginResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Start not loading — the landing page should render immediately without auth
  const [isLoading, setIsLoading] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  const checkAuth = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as {
          name: string
          email: string
          jobRole: string
          isAdmin?: boolean
        }
        // /api/auth/me returns { name, email, jobRole, isAdmin } directly
        // (not nested under .user). Absent `isAdmin` → false so
        // admin-only UI fails closed.
        setUser({
          name: data.name,
          email: data.email,
          jobRole: data.jobRole,
          isAdmin: data.isAdmin === true,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
      setHasChecked(true)
    }
  }, [])

  // Always verify the session on mount by calling /api/auth/me. The
  // previous hint-cookie shortcut (skip checkAuth when `cpo_has_session`
  // was absent) caused THE-551: if the hint cookie was missing for any
  // reason — browser privacy mode, extension interference, stale-clear
  // after a transient 401 — but the real HttpOnly `cpo_session` cookie
  // was still valid, the frontend would silently mark the user as
  // logged out and redirect them to the magic-link flow on every new
  // window. Always hitting /me is cheap and lets the server be the
  // single source of truth.
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (email: string): Promise<LoginResult> => {
    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    })

    if (res.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.")
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Something went wrong")
    }

    return res.json()
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasChecked,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
