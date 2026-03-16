import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

interface User {
  name: string
  email: string
  jobRole: string
}

interface LoginResult {
  code: string
  memberStatus: 'sent' | 'not_found'
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
        const data = await res.json()
        // /api/auth/me returns { name, email, jobRole } directly (not nested under .user)
        setUser(data)
      } else {
        setUser(null)
        // Clear stale hint cookie on auth failure
        document.cookie = 'cpo_has_session=; path=/; max-age=0'
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
      setHasChecked(true)
    }
  }, [])

  // Auto-check session on mount if the hint cookie is present.
  // If no hint cookie, mark as checked immediately (no fetch needed).
  useEffect(() => {
    if (document.cookie.includes('cpo_has_session')) {
      checkAuth()
    } else {
      setHasChecked(true)
    }
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
