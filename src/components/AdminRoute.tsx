import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'

/** Route guard for admin-only pages. Wraps `ProtectedRoute` (which
 *  handles the auth-check-on-mount, loading spinner, and redirect for
 *  unauthenticated users) and then layers an `isAdmin` check on top —
 *  authenticated non-admins see a visible 403 card instead of a silent
 *  redirect, so they get a clear signal they hit the wrong URL. */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  )
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (!user?.isAdmin) {
    return (
      <div className="container py-16">
        <Card
          className="mx-auto max-w-md border-destructive/50 bg-destructive/5"
          data-testid="admin-denied"
        >
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
            <h2 className="text-base font-semibold">Admin access required</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              This page is only available to community admins. If you
              think this is a mistake, let us know.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/members/chat-insights">Back to Chat Insights</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
