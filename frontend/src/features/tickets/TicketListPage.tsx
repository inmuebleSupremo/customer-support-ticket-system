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

  return <section className="space-y-6" aria-labelledby="tickets-title">
    <PageHeader id="tickets-title" eyebrow="Your support space" title="My tickets" meta={result ? `${result.totalElements} ${result.totalElements === 1 ? 'ticket' : 'tickets'}` : undefined} actions={<ButtonLink to="/tickets/new">Create ticket</ButtonLink>}>Review every support request and open a ticket to see its full conversation and activity.</PageHeader>
    {error && <Alert tone="danger">{error}</Alert>}
    {result === null && !error && <LoadingState label="Loading your tickets…" />}
    {result && (result.content.length === 0 ? <EmptyState title="No tickets yet" action={<ButtonLink to="/tickets/new">Create a ticket</ButtonLink>}>You have not created any tickets yet. Create one when you need help, then follow its progress here.</EmptyState> : <><TicketResults tickets={result.content} /><Pagination first={result.first} last={result.last} page={result.page} totalPages={result.totalPages} onPageChange={setPage} /></>)}
  </section>
}

function TicketResults({ tickets }: { tickets: TicketSummary[] }) {
  return <Panel className="overflow-hidden border-slate-300 p-0"><div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><tr><th scope="col" className="px-5 py-3">Case</th><th scope="col" className="px-5 py-3">Support request</th><th scope="col" className="px-5 py-3">Status</th><th scope="col" className="px-5 py-3">Priority</th><th scope="col" className="px-5 py-3">Last activity</th></tr></thead><tbody className="divide-y divide-slate-200">{tickets.map(ticket => <tr key={ticket.id} className="group transition-colors hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 align-top"><Link className="rd-case-reference rounded-sm hover:underline focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.reference}</Link></td><td className="min-w-[19rem] px-5 py-4 align-top"><Link className="block rounded-sm text-sm font-semibold text-slate-950 transition-colors group-hover:text-sky-800 focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.title}</Link><p className="mt-1 text-sm text-slate-600">Your support request</p></td><td className="px-5 py-4 align-top"><StatusBadge status={ticket.status} /></td><td className="px-5 py-4 align-top"><PriorityBadge priority={ticket.priority} /></td><td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-600">{formatUpdated(ticket.updatedAt)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 md:hidden">{tickets.map(ticket => <li key={ticket.id}><Link className="block px-4 py-5 transition-colors hover:bg-slate-50 focus-visible:outline-sky-700 sm:px-5" to={`/tickets/${ticket.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="rd-case-reference">{ticket.reference}</p><p className="mt-1 text-base font-semibold leading-6 text-slate-950">{ticket.title}</p></div><div className="shrink-0"><StatusBadge status={ticket.status} /></div></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4"><div><p className="rd-meta-label">Priority</p><div className="mt-1"><PriorityBadge priority={ticket.priority} /></div></div><div><p className="rd-meta-label">Last activity</p><p className="mt-1 text-xs leading-5 text-slate-600">{formatUpdated(ticket.updatedAt)}</p></div></div></Link></li>)}</ul></Panel>
}
