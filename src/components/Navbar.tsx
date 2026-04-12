import { useState, useEffect } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { LoginModal } from "@/components/LoginModal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, LogOut, Sun, Moon, Download } from "lucide-react"
import { useInstallPrompt } from "@/hooks/useInstallPrompt"
import { useTheme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/members/directory/MemberAvatar"
import logo from "@/assets/logo.png"

const publicLinks = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Channels", href: "#channels" },
  { label: "Events", href: "#events" },
  { label: "Founders", href: "#founders" },
]

const memberLinks = [
  { label: "Chat Insights", to: "/members/chat-insights" },
  { label: "What's Talked", to: "/members/whats-talked" },
  { label: "Directory", to: "/members/directory" },
  { label: "Profile", to: "/members/profile" },
]

const adminLinks = [
  { label: "Admin · Ingestion", to: "/members/admin/ingestion-history" },
]

export function Navbar() {
  const { user, isAuthenticated, hasChecked, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { canInstall, promptInstall } = useInstallPrompt()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [verifyError, setVerifyError] = useState<string | undefined>()

  const isLandingPage = location.pathname === "/"
  const isMembersPage = location.pathname.startsWith("/members")
  const visibleMemberLinks = user?.isAdmin
    ? [...memberLinks, ...adminLinks]
    : memberLinks

  // Auto-open login modal from location state (redirect from ProtectedRoute)
  useEffect(() => {
    if (location.state?.showLogin) {
      setLoginModalOpen(true)
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Handle verify search param (magic link errors)
  useEffect(() => {
    const verify = searchParams.get("verify")
    if (verify) {
      let message: string
      switch (verify) {
        case "expired":
          message = "Your login link has expired. Please request a new one."
          break
        case "invalid":
          message = "That login link is invalid. Please request a new one."
          break
        default:
          message = "Something went wrong. Please request a new login link."
      }
      setVerifyError(message)
      setLoginModalOpen(true)
      // Clean the URL
      searchParams.delete("verify")
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleClearVerifyError = () => {
    setVerifyError(undefined)
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src={logo} alt="CPO Connect" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight">
              CPO <span className="text-primary">Connect</span>
            </span>
          </Link>

          {/* Desktop nav — right-aligned, matching original spec */}
          <nav className="hidden md:flex items-center gap-8">
            {isLandingPage &&
              publicLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            {isAuthenticated &&
              isMembersPage &&
              visibleMemberLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-foreground",
                    location.pathname === link.to
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            {canInstall && isAuthenticated && isMembersPage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={promptInstall}
                className="h-8 w-8"
                aria-label="Install app"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {hasChecked && !isAuthenticated && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLoginModalOpen(true)}
                >
                  Login
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground rounded-lg" asChild>
                  <a
                    href="https://cpoconnect.fillout.com/application"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apply to Join
                  </a>
                </Button>
              </>
            )}
            {hasChecked && isAuthenticated && isLandingPage && (
              <Button size="sm" asChild>
                <Link to="/members/chat-insights">Members Area</Link>
              </Button>
            )}
            {hasChecked && isAuthenticated && isMembersPage && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <MemberAvatar name={user.name} size={32} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <nav className="container py-4 flex flex-col space-y-3">
              {isLandingPage &&
                publicLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              {isAuthenticated &&
                isMembersPage &&
                visibleMemberLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-foreground",
                      location.pathname === link.to
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              <div className="flex flex-col space-y-2 pt-3 border-t">
                {canInstall && isAuthenticated && isMembersPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      promptInstall()
                      setMobileMenuOpen(false)
                    }}
                    className="justify-start"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Install App
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="justify-start"
                >
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </Button>
                {hasChecked && !isAuthenticated && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLoginModalOpen(true)
                        setMobileMenuOpen(false)
                      }}
                    >
                      Login
                    </Button>
                    <Button size="sm" asChild>
                      <a
                        href="https://cpoconnect.fillout.com/application"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Apply to Join
                      </a>
                    </Button>
                  </>
                )}
                {hasChecked && isAuthenticated && isLandingPage && (
                  <Button size="sm" asChild>
                    <Link
                      to="/members/chat-insights"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Members Area
                    </Link>
                  </Button>
                )}
                {hasChecked && isAuthenticated && isMembersPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      logout()
                      setMobileMenuOpen(false)
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <LoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        verifyError={verifyError}
        onClearVerifyError={handleClearVerifyError}
      />
    </>
  )
}
