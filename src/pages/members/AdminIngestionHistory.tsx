import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Inbox,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface SyncMembersResponse {
  totalRows: number
  upserted: number
  skippedNotJoined: number
  nameBlank: number
  phoneFailed: number
}

async function postSyncMembers(): Promise<SyncMembersResponse> {
  const res = await fetch('/api/admin/chat/sync-members', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`sync-members failed (${res.status}): ${body || 'internal'}`)
  }
  return (await res.json()) as SyncMembersResponse
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

function isValidIsoDate(iso: string | null | undefined): iso is string {
  if (!iso) return false
  return !Number.isNaN(new Date(iso).getTime())
}

function formatTimestamp(iso: string | null): string {
  // Empty-string (backend `toIsoOrEmpty` on a NULL corpus aggregate),
  // null, and unparseable input all render as an em-dash.
  if (!isValidIsoDate(iso)) return '—'
  return TIMESTAMP_FORMAT.format(new Date(iso))
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
  const queryClient = useQueryClient()
  const query = useQuery<IngestionHistoryResponse>({
    queryKey: ['admin-ingestion-runs'],
    queryFn: fetchIngestionHistory,
  })

  const [syncResult, setSyncResult] = useState<SyncMembersResponse | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncMutation = useMutation<SyncMembersResponse, Error, void>({
    mutationFn: postSyncMembers,
    onMutate: () => {
      setSyncResult(null)
      setSyncError(null)
    },
    onSuccess: (result) => {
      setSyncResult(result)
      void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-runs'] })
    },
    onError: (err) => {
      setSyncError(err.message)
    },
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

      <section aria-label="Member directory sync" className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing members…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync members from sheet
              </>
            )}
          </Button>
          {syncResult && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Synced {syncResult.upserted} of {syncResult.totalRows} rows
              {syncResult.phoneFailed > 0 &&
                ` · ${syncResult.phoneFailed} phone-normalize failures`}
            </span>
          )}
          {syncError && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {syncError}
            </span>
          )}
        </div>
      </section>

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
            value={
              isValidIsoDate(data.latestMessageAt) ? (
                <time dateTime={data.latestMessageAt}>
                  {formatTimestamp(data.latestMessageAt)}
                </time>
              ) : (
                formatTimestamp(data.latestMessageAt)
              )
            }
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
  value: React.ReactNode
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
      <td className="px-3 py-2">
        {isValidIsoDate(run.runStartedAt) ? (
          <time dateTime={run.runStartedAt}>
            {formatTimestamp(run.runStartedAt)}
          </time>
        ) : (
          formatTimestamp(run.runStartedAt)
        )}
      </td>
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
