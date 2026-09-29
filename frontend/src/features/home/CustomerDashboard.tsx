import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badges'
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

  return <section className="space-y-8" aria-labelledby="customer-dashboard-title"><PageHeader id="customer-dashboard-title" eyebrow="Customer workspace" title={`Welcome, ${user.firstName}.`} actions={<ButtonLink to="/tickets/new">Create ticket</ButtonLink>}>Review your support requests and pick up where you left off.</PageHeader>{error && <Alert tone="danger">{error}</Alert>}{data === null && !error && <LoadingState label="Loading your support workspace…" />}{data && (data.recent.totalElements === 0 ? <EmptyState title="No support requests yet" action={<ButtonLink to="/tickets/new">Create your first ticket</ButtonLink>}>When you need help, create a ticket and follow its progress here.</EmptyState> : <><section aria-labelledby="ticket-summary-title"><h2 id="ticket-summary-title" className="text-lg font-semibold text-slate-950">Ticket overview</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statuses.map(status => <Panel key={status} className="p-4"><dt><StatusBadge status={status} /></dt><dd className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{data.counts[status]}</dd><p className="mt-1 text-sm text-slate-600">{data.counts[status] === 1 ? 'ticket' : 'tickets'}</p></Panel>)}</dl></section><section aria-labelledby="recent-tickets-title"><div className="flex items-center justify-between gap-4"><div><h2 id="recent-tickets-title" className="text-lg font-semibold text-slate-950">Recent tickets</h2><p className="mt-1 text-sm text-slate-600">Your five most recently updated support requests.</p></div><ButtonLink variant="quiet" to="/tickets">View all</ButtonLink></div><ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">{data.recent.content.map(ticket => <li key={ticket.id}><Link to={`/tickets/${ticket.id}`} className="block px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-sky-700 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-sky-800">{ticket.reference}</p><p className="mt-1 truncate font-semibold text-slate-950">{ticket.title}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} /><span className="text-xs text-slate-500">Updated {formatUpdated(ticket.updatedAt)}</span></div></div></Link></li>)}</ul></section></>)}</section>
}
