import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Loader2 } from "lucide-react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hasChecked, checkAuth } = useAuth()

  // If auth hasn't been checked yet (e.g., direct navigation to /members/*), trigger it
  useEffect(() => {
    if (!hasChecked && !isLoading) {
      checkAuth()
    }
  }, [hasChecked, isLoading, checkAuth])

  // Show spinner while checking auth
  if (!hasChecked || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ showLogin: true }} />
  }

  return <>{children}</>
}
