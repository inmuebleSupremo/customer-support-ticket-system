import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { listTickets, type TicketSummary } from '../../api/tickets'

export function TicketListPage() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listTickets()
      .then(response => setTickets(response.content))
      .catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load your tickets.'))
  }, [])

  if (error) return <section aria-labelledby="tickets-title"><h1 id="tickets-title" className="text-3xl font-bold">Your tickets</h1><p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-800">{error}</p></section>
  if (tickets === null) return <p role="status">Loading your tickets…</p>

  return (
    <section aria-labelledby="tickets-title" className="space-y-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">Customer workspace</p><h1 id="tickets-title" className="mt-2 text-3xl font-bold">Your tickets</h1></div><Link className="rounded bg-sky-700 px-4 py-2 font-medium text-white" to="/tickets/new">Create a ticket</Link></div>
      {tickets.length === 0 ? <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-slate-600">You have not created any tickets yet.</p> : <ul className="space-y-3">{tickets.map(ticket => <li key={ticket.id}><Link className="block rounded border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300" to={`/tickets/${ticket.id}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{ticket.reference}</span><span className="text-sm text-slate-600">{ticket.status} · {ticket.priority}</span></div><p className="mt-2 font-medium">{ticket.title}</p><p className="mt-1 text-sm text-slate-600">Updated {new Date(ticket.updatedAt).toLocaleString()}</p></Link></li>)}</ul>}
    </section>
  )
}
