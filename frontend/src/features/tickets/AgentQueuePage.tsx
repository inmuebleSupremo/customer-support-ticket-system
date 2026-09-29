import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { getAgents, listTickets, type AgentSummary, type PageResponse, type TicketListQuery, type TicketSummary } from '../../api/tickets'

const emptyFilters = { status: '', priority: '', assignedAgentId: '', unassigned: false, search: '', sort: 'updatedAt,desc' }

export function AgentQueuePage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [query, setQuery] = useState<TicketListQuery>({ sort: 'updatedAt,desc' })
  const [result, setResult] = useState<PageResponse<TicketSummary> | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setResult(null)
    setError(null)
    void listTickets(query)
      .then(setResult)
      .catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load the support queue.'))
  }, [query])

  useEffect(() => {
    void getAgents().then(setAgents).catch(() => setAgents([]))
  }, [])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery({
      status: filters.status as TicketListQuery['status'] || undefined,
      priority: filters.priority as TicketListQuery['priority'] || undefined,
      assignedAgentId: filters.assignedAgentId || undefined,
      unassigned: filters.unassigned || undefined,
      search: filters.search.trim() || undefined,
      sort: filters.sort,
      page: 0
    })
  }

  function changePage(page: number) {
    setQuery(current => ({ ...current, page }))
  }

  return (
    <section aria-labelledby="queue-title" className="space-y-6">
      <div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">Support workspace</p><h1 id="queue-title" className="mt-2 text-3xl font-bold">Ticket queue</h1></div>
      <form className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <label className="text-sm font-medium" htmlFor="queue-status">Status<select id="queue-status" className="mt-1 block w-full rounded border p-2" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></label>
        <label className="text-sm font-medium" htmlFor="queue-priority">Priority<select id="queue-priority" className="mt-1 block w-full rounded border p-2" value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
        <label className="text-sm font-medium" htmlFor="queue-assignee">Assigned agent<select id="queue-assignee" className="mt-1 block w-full rounded border p-2" value={filters.assignedAgentId} disabled={filters.unassigned} onChange={event => setFilters(current => ({ ...current, assignedAgentId: event.target.value }))}><option value="">All assigned agents</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select></label>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium" htmlFor="queue-unassigned"><input id="queue-unassigned" type="checkbox" checked={filters.unassigned} onChange={event => setFilters(current => ({ ...current, unassigned: event.target.checked, assignedAgentId: event.target.checked ? '' : current.assignedAgentId }))} />Unassigned only</label>
        <label className="text-sm font-medium sm:col-span-2" htmlFor="queue-search">Search<input id="queue-search" className="mt-1 block w-full rounded border p-2" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Ticket reference or title" /></label>
        <label className="text-sm font-medium" htmlFor="queue-sort">Sort<select id="queue-sort" className="mt-1 block w-full rounded border p-2" value={filters.sort} onChange={event => setFilters(current => ({ ...current, sort: event.target.value }))}><option value="updatedAt,desc">Updated, newest first</option><option value="updatedAt,asc">Updated, oldest first</option><option value="createdAt,desc">Created, newest first</option><option value="priority,asc">Priority</option><option value="status,asc">Status</option><option value="title,asc">Title</option></select></label>
        <div className="flex items-end"><button className="rounded bg-sky-700 px-4 py-2 font-medium text-white" type="submit">Apply filters</button></div>
      </form>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {result === null && !error && <p role="status">Loading support queue…</p>}
      {result && (result.content.length === 0 ? <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-slate-600">No tickets match the current queue filters.</p> : <div className="overflow-x-auto rounded border border-slate-200 bg-white"><table className="min-w-full text-left"><thead className="bg-slate-100 text-sm"><tr><th className="p-3">Reference</th><th className="p-3">Title</th><th className="p-3">Customer</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Assigned agent</th><th className="p-3">Created</th><th className="p-3">Updated</th></tr></thead><tbody>{result.content.map(ticket => <tr key={ticket.id} className="border-t"><td className="p-3"><Link className="text-sky-700 underline" to={`/tickets/${ticket.id}`}>{ticket.reference}</Link></td><td className="p-3">{ticket.title}</td><td className="p-3">{ticket.customer.displayName}</td><td className="p-3">{ticket.priority}</td><td className="p-3">{ticket.status}</td><td className="p-3">{ticket.assignedAgent?.displayName ?? 'Unassigned'}</td><td className="p-3 text-sm">{new Date(ticket.createdAt).toLocaleString()}</td><td className="p-3 text-sm">{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>)}
      {result && result.totalPages > 1 && <nav aria-label="Queue pagination" className="flex items-center gap-3"><button className="rounded border px-3 py-1 disabled:opacity-50" type="button" disabled={result.first} onClick={() => changePage(result.page - 1)}>Previous</button><span>Page {result.page + 1} of {result.totalPages}</span><button className="rounded border px-3 py-1 disabled:opacity-50" type="button" disabled={result.last} onClick={() => changePage(result.page + 1)}>Next</button></nav>}
    </section>
  )
}
