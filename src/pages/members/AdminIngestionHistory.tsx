import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock, Database, Inbox, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface IngestionRun {
  id: number
  runStartedAt: string
  runCompletedAt: string | null
  triggeredBy: string
  sourceMonths: string[]
  messagesIngested: number
  messagesSkipped: number
  status: 'running' | 'success' | 'failed'
  errorMessage: string | null
}

interface IngestionHistoryResponse {
  runs: IngestionRun[]
  totalMessages: number
  latestMessageAt: string
}

async function fetchIngestionHistory(): Promise<IngestionHistoryResponse> {
  const res = await fetch('/api/admin/chat/ingestion-runs', {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load ingestion history (${res.status})`)
  }
  return (await res.json()) as IngestionHistoryResponse
}

// Module-hoisted formatter — avoids instantiating a fresh Intl object
// once per table cell on every render.
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTimestamp(iso: string | null): string {
  // Empty-string (backend `toIsoOrEmpty` on a NULL corpus aggregate) and
  // null both render as an em-dash.
  if (!iso) return '—'
  const d = new Date(iso)
  // `new Date('garbage')` returns an Invalid Date (NaN getTime) rather
  // than throwing, so guard explicitly before formatting.
  if (Number.isNaN(d.getTime())) return '—'
  return TIMESTAMP_FORMAT.format(d)
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function statusBadgeVariant(
  status: IngestionRun['status'],
): 'default' | 'secondary' | 'destructive' {
  if (status === 'success') return 'secondary'
  if (status === 'failed') return 'destructive'
  return 'default'
}

export default function AdminIngestionHistory() {
  const query = useQuery<IngestionHistoryResponse>({
    queryKey: ['admin-ingestion-runs'],
    queryFn: fetchIngestionHistory,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold font-display">Ingestion History</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Admin-only view of the last 50 WhatsApp chat ingestion runs, plus
          aggregate corpus size across the whole indexed history.
        </p>
      </header>

      {query.isLoading ? (
        <div
          role="status"
          className="flex items-center gap-2 py-12 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading ingestion history…
        </div>
      ) : query.isError ? (
        <Card className="border-destructive/50 bg-destructive/5" role="alert">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertCircle
              className="h-5 w-5 flex-shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-semibold">
                Couldn't load ingestion history
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The admin endpoint returned an error. Check the server logs
                and reload the page.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : query.data ? (
        <Body data={query.data} />
      ) : null}
    </div>
  )
}

function Body({ data }: { data: IngestionHistoryResponse }) {
  return (
    <div className="space-y-6">
      <section aria-label="Corpus aggregates">
        <div className="grid gap-3 sm:grid-cols-2">
          <AggregateCard
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            label="Total messages"
            value={formatNumber(data.totalMessages)}
          />
          <AggregateCard
            icon={<Clock className="h-4 w-4" aria-hidden="true" />}
            label="Latest message"
            value={formatTimestamp(data.latestMessageAt)}
          />
        </div>
      </section>

      {data.runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold">
              No ingestion runs recorded yet
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Ingestion runs from the local CLI or admin panel will appear
              here after the first successful import.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section aria-label="Recent ingestion runs">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Run</th>
                  <th scope="col" className="px-3 py-2 font-medium">Started</th>
                  <th scope="col" className="px-3 py-2 font-medium">Triggered by</th>
                  <th scope="col" className="px-3 py-2 font-medium">Months</th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">
                    Ingested
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">
                    Skipped
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function AggregateCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold font-display">{value}</p>
      </CardContent>
    </Card>
  )
}

function RunRow({ run }: { run: IngestionRun }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-xs">{run.id}</td>
      <td className="px-3 py-2">{formatTimestamp(run.runStartedAt)}</td>
      <td className="px-3 py-2">{run.triggeredBy || '—'}</td>
      <td className="px-3 py-2">
        {run.sourceMonths.length > 0 ? run.sourceMonths.join(', ') : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {formatNumber(run.messagesIngested)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {formatNumber(run.messagesSkipped)}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Badge variant={statusBadgeVariant(run.status)} className="w-fit capitalize">
            {run.status}
          </Badge>
          {run.errorMessage ? (
            <span className="text-xs text-destructive">
              {run.errorMessage}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
