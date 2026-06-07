import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Eye,
  Loader2,
  Repeat,
  Route as RouteIcon,
  UserCircle,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PerDay {
  day: string
  count: number
}

interface TopPath {
  path: string
  count: number
}

interface PerUser {
  email: string
  pageViews: number
  activeDays: number
  lastSeen: string
}

interface Journey {
  email: string
  steps: { path: string; at: string }[]
}

interface AnalyticsOverview {
  windowDays: number
  visits: { total: number; anonymous: number; perDay: PerDay[] }
  users: { unique: number; repeat: number }
  engagement: { topPaths: TopPath[]; perUser: PerUser[] }
  journeys: Journey[]
}

async function fetchOverview(): Promise<AnalyticsOverview> {
  const res = await fetch('/api/admin/analytics/overview', {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load analytics (${res.status})`)
  }
  return (await res.json()) as AnalyticsOverview
}

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

function formatTimestamp(iso: string): string {
  if (!isValidIsoDate(iso)) return '—'
  return TIMESTAMP_FORMAT.format(new Date(iso))
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

export default function AdminAnalytics() {
  const query = useQuery<AnalyticsOverview>({
    queryKey: ['admin-analytics-overview'],
    queryFn: fetchOverview,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold font-display">User Analytics</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Admin-only readout of basic usage over the last 30 days — page
          visits, repeat visitors, per-user engagement, and recent journeys.
          Derived from the in-app event log; identified by member email only.
        </p>
      </header>

      {query.isLoading ? (
        <div
          role="status"
          className="flex items-center gap-2 py-12 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading analytics…
        </div>
      ) : query.isError ? (
        <Card className="border-destructive/50 bg-destructive/5" role="alert">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertCircle
              className="h-5 w-5 flex-shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-semibold">Couldn't load analytics</h2>
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

function Body({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="space-y-8">
      <section aria-label="Headline metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            label="Page visits (30d)"
            value={formatNumber(data.visits.total)}
          />
          <StatCard
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            label="Unique members"
            value={formatNumber(data.users.unique)}
          />
          <StatCard
            icon={<Repeat className="h-4 w-4" aria-hidden="true" />}
            label="Repeat members"
            value={formatNumber(data.users.repeat)}
          />
          <StatCard
            icon={<UserCircle className="h-4 w-4" aria-hidden="true" />}
            label="Anonymous visits"
            value={formatNumber(data.visits.anonymous)}
          />
        </div>
      </section>

      <Section title="Visits per day">
        {data.visits.perDay.length === 0 ? (
          <EmptyNote>No page views recorded in the last 30 days.</EmptyNote>
        ) : (
          <SimpleTable
            head={['Day', 'Visits']}
            rows={data.visits.perDay.map((d) => [d.day, formatNumber(d.count)])}
            numericCols={[1]}
          />
        )}
      </Section>

      <Section title="Top paths">
        {data.engagement.topPaths.length === 0 ? (
          <EmptyNote>No paths recorded yet.</EmptyNote>
        ) : (
          <SimpleTable
            head={['Path', 'Views']}
            rows={data.engagement.topPaths.map((p) => [
              p.path,
              formatNumber(p.count),
            ])}
            numericCols={[1]}
            monoCols={[0]}
          />
        )}
      </Section>

      <Section title="Engagement by member">
        {data.engagement.perUser.length === 0 ? (
          <EmptyNote>No member activity recorded yet.</EmptyNote>
        ) : (
          <SimpleTable
            head={['Member', 'Page views', 'Active days', 'Last seen']}
            rows={data.engagement.perUser.map((u) => [
              u.email,
              formatNumber(u.pageViews),
              formatNumber(u.activeDays),
              formatTimestamp(u.lastSeen),
            ])}
            numericCols={[1, 2]}
          />
        )}
      </Section>

      <Section
        title="Recent journeys"
        icon={<RouteIcon className="h-4 w-4" aria-hidden="true" />}
      >
        {data.journeys.length === 0 ? (
          <EmptyNote>No journeys recorded yet.</EmptyNote>
        ) : (
          <div className="space-y-3">
            {data.journeys.map((j) => (
              <Card key={j.email}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{j.email}</p>
                  <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {j.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span aria-hidden="true">→</span>}
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                          {step.path}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function StatCard({
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

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function SimpleTable({
  head,
  rows,
  numericCols = [],
  monoCols = [],
}: {
  head: string[]
  rows: React.ReactNode[][]
  numericCols?: number[]
  monoCols?: number[]
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={`px-3 py-2 font-medium ${
                  numericCols.includes(i) ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    numericCols.includes(ci) ? 'text-right font-mono' : ''
                  } ${monoCols.includes(ci) ? 'font-mono text-xs' : ''}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
