import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../../components/ui/Button'
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { ApiError } from '../../api/client'
import { listTickets, type PageResponse, type TicketDetail, type TicketSummary } from '../../api/tickets'
import type { CurrentUser } from '../../api/auth'

const statuses: TicketDetail['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

interface DashboardData {
  recent: PageResponse<TicketSummary>
  counts: Record<TicketDetail['status'], number>
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function CustomerDashboard({ user }: { user: CurrentUser }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void Promise.all([listTickets({ page: 0, size: 5, sort: 'updatedAt,desc' }), ...statuses.map(status => listTickets({ status, page: 0, size: 1 }))]).then(([recent, ...summaries]) => {
      if (!current) return
      setData({ recent, counts: Object.fromEntries(statuses.map((status, index) => [status, summaries[index].totalElements])) as DashboardData['counts'] })
      setError(null)
    }).catch(requestError => {
      if (!current) return
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to load your support workspace.')
    })
    return () => { current = false }
  }, [])

  return <section className="space-y-7" aria-labelledby="customer-dashboard-title">
    <PageHeader id="customer-dashboard-title" eyebrow="Your support space" title={`Welcome, ${user.firstName}.`} meta={data ? `${data.recent.totalElements} ${data.recent.totalElements === 1 ? 'request' : 'requests'}` : undefined} actions={<ButtonLink to="/tickets/new">Create ticket</ButtonLink>}>Start a new request, or review the latest progress on the support tickets you already have.</PageHeader>
    {error && <Alert tone="danger">{error}</Alert>}
    {data === null && !error && <LoadingState label="Loading your support workspace…" />}
    {data && (data.recent.totalElements === 0 ? <EmptyState title="No support requests yet" action={<ButtonLink to="/tickets/new">Create your first ticket</ButtonLink>}>When something needs attention, create a ticket with a clear description. You can follow every update here.</EmptyState> : <>
      <section aria-labelledby="ticket-summary-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="rd-meta-label">Your requests</p><h2 id="ticket-summary-title" className="mt-1 text-lg font-semibold text-slate-950">Status at a glance</h2></div><p className="text-sm text-slate-600">A simple view of where your requests stand.</p></div><dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statuses.map(status => <Panel key={status} className="border-slate-300 p-4"><dt><StatusBadge status={status} /></dt><dd className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{data.counts[status]}</dd><p className="mt-1 text-sm text-slate-600">{data.counts[status] === 1 ? 'request' : 'requests'}</p></Panel>)}</dl></section>
      <section aria-labelledby="recent-tickets-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="rd-meta-label">Recent activity</p><h2 id="recent-tickets-title" className="mt-1 text-lg font-semibold text-slate-950">Recent tickets</h2><p className="mt-1 text-sm text-slate-600">Your five most recently updated support requests.</p></div><ButtonLink variant="quiet" to="/tickets">View all tickets</ButtonLink></div><ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white">{data.recent.content.map(ticket => <li key={ticket.id}><Link to={`/tickets/${ticket.id}`} className="block px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-sky-700 sm:px-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="rd-case-reference">{ticket.reference}</p><p className="mt-1 truncate font-semibold text-slate-950">{ticket.title}</p></div><div className="shrink-0"><StatusBadge status={ticket.status} /></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><PriorityBadge priority={ticket.priority} /><p className="text-xs text-slate-500">Last updated {formatUpdated(ticket.updatedAt)}</p></div></Link></li>)}</ul></section>
    </>)}
  </section>
}
