import { Navbar } from "@/components/Navbar"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { WifiOff } from "lucide-react"

export function MembersLayout({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {!online && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          You're offline — showing cached directory data
        </div>
      )}
      <main className="container py-8">{children}</main>
    </div>
  )
}
