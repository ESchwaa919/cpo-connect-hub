import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function WhatsTalkedErrorFallback() {
  return (
    <Card
      className="border-destructive/50 bg-destructive/5"
      role="alert"
      data-testid="whats-talked-error-fallback"
    >
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <AlertCircle
          className="h-6 w-6 text-destructive"
          aria-hidden="true"
        />
        <h2 className="text-base font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The What's Talked page ran into an unexpected error. Reload the
          page to try again — if the problem persists let an admin know.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/members/chat-insights">Back to Chat Insights</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
