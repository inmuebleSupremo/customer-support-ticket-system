import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../../components/ui/Button'
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { Panel } from '../../components/ui/Panel'
import { ApiError } from '../../api/client'
import { listTickets, type PageResponse, type TicketSummary } from '../../api/tickets'

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function TicketListPage() {
  const [result, setResult] = useState<PageResponse<TicketSummary> | null>(null)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setResult(null)
    setError(null)
    void listTickets({ page, size: 20, sort: 'updatedAt,desc' }).then(setResult).catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load your tickets.'))
  }, [page])

  return <section className="space-y-6" aria-labelledby="tickets-title"><PageHeader id="tickets-title" eyebrow="Customer workspace" title="Your tickets" actions={<ButtonLink to="/tickets/new">Create ticket</ButtonLink>}>Track your support requests and review the latest activity.</PageHeader>{error && <Alert tone="danger">{error}</Alert>}{result === null && !error && <LoadingState label="Loading your tickets…" />}{result && (result.content.length === 0 ? <EmptyState title="No tickets found" action={<ButtonLink to="/tickets/new">Create a ticket</ButtonLink>}>You have not created any tickets yet.</EmptyState> : <><Panel className="overflow-hidden p-0"><div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Title</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Updated</th></tr></thead><tbody className="divide-y divide-slate-200">{result.content.map(ticket => <tr key={ticket.id} className="transition-colors hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-sky-800"><Link className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.reference}</Link></td><td className="max-w-xl px-5 py-4"><Link className="block rounded-sm font-semibold text-slate-950 hover:text-sky-800 focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.title}</Link></td><td className="px-5 py-4"><StatusBadge status={ticket.status} /></td><td className="px-5 py-4"><PriorityBadge priority={ticket.priority} /></td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{formatUpdated(ticket.updatedAt)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 md:hidden">{result.content.map(ticket => <li key={ticket.id}><Link className="block px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-sky-800">{ticket.reference}</p><p className="mt-1 font-semibold text-slate-950">{ticket.title}</p></div><div className="shrink-0"><StatusBadge status={ticket.status} /></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><PriorityBadge priority={ticket.priority} /><p className="text-xs text-slate-500">Updated {formatUpdated(ticket.updatedAt)}</p></div></Link></li>)}</ul></Panel><Pagination first={result.first} last={result.last} page={result.page} totalPages={result.totalPages} onPageChange={setPage} /></>)}</section>
}
