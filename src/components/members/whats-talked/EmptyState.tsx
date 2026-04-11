import { MessageCircleQuestion } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
      <MessageCircleQuestion className="mb-3 h-10 w-10 text-muted-foreground" />
      <h3 className="text-base font-semibold">Ask the group chat anything</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Pick a suggested prompt above or type your own question to search
        across the community chat history.
      </p>
    </div>
  )
}
