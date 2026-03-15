import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

type ModalState = "email" | "sent" | "not-member" | "error"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  verifyError?: string
  onClearVerifyError?: () => void
}

export function LoginModal({
  open,
  onOpenChange,
  verifyError,
  onClearVerifyError,
}: LoginModalProps) {
  const { login } = useAuth()
  const [state, setState] = useState<ModalState>("email")
  const [email, setEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If verifyError is set, start in error state
  useEffect(() => {
    if (verifyError) {
      setErrorMessage(verifyError)
      setState("error")
    }
  }, [verifyError])

  // Reset state when modal closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setState("email")
      setEmail("")
      setErrorMessage("")
      setIsSubmitting(false)
      onClearVerifyError?.()
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)
    try {
      const result = await login(email.trim())
      if (result.memberStatus === "not_found") {
        setState("not-member")
      } else {
        setState("sent")
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong"
      setErrorMessage(message)
      setState("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state === "email" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Sign in to CPO Connect</DialogTitle>
              <DialogDescription>
                Enter your email and we'll send you a magic link to sign in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Magic Link
              </Button>
            </form>
          </>
        )}

        {state === "sent" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Check your inbox</DialogTitle>
              <DialogDescription>
                We've sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="rounded-full bg-primary/10 p-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                The link will expire in 15 minutes. If you don't see the email,
                check your spam folder.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setState("email")
                setEmail("")
              }}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try a different email
            </Button>
          </>
        )}

        {state === "not-member" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">We don't recognise that email</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{email}</span>{" "}
                isn't associated with a CPO Connect membership.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <Mail className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                CPO Connect is a members-only community. If you'd like to join,
                submit an application.
              </p>
            </div>
            <div className="space-y-2">
              <Button className="w-full" asChild>
                <a
                  href="https://cpoconnect.fillout.com/application"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apply to Join
                </a>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setState("email")
                  setEmail("")
                }}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Try a different email
              </Button>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Something went wrong</DialogTitle>
              <DialogDescription>{errorMessage}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <Button
              onClick={() => {
                setState("email")
                setEmail("")
                setErrorMessage("")
                onClearVerifyError?.()
              }}
              className="w-full"
            >
              Try again
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
