import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

const navLinks = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Channels", href: "#channels" },
  { label: "Events", href: "#events" },
  { label: "Founders", href: "#founders" },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CPO Connect
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center space-x-3">
          <Button variant="ghost" size="sm">
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
        </div>

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
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col space-y-2 pt-3 border-t">
              <Button variant="ghost" size="sm">
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
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
