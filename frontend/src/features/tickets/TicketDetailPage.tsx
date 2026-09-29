import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { getTicket, getTicketHistory, type TicketDetail, type TicketHistoryEntry } from '../../api/tickets'

function displayEvent(eventType: TicketHistoryEntry['eventType']) {
  return eventType.split('_').map(word => word[0] + word.slice(1).toLowerCase()).join(' ')
}

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [history, setHistory] = useState<TicketHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticketId) return
    void Promise.all([getTicket(ticketId), getTicketHistory(ticketId)])
      .then(([ticketResponse, historyResponse]) => {
        setTicket(ticketResponse)
        setHistory(historyResponse)
      })
      .catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load this ticket.'))
  }, [ticketId])

  if (error) return <section aria-labelledby="ticket-detail-title"><h1 id="ticket-detail-title" className="text-3xl font-bold">Ticket unavailable</h1><p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-800">{error}</p><Link className="mt-4 inline-block text-sky-700 underline" to="/tickets">Back to your tickets</Link></section>
  if (ticket === null || history === null) return <p role="status">Loading ticket…</p>

  return (
    <section aria-labelledby="ticket-detail-title" className="mx-auto max-w-3xl space-y-8">
      <Link className="text-sky-700 underline" to="/tickets">Back to your tickets</Link>
      <div className="rounded border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-wide text-sky-700">{ticket.reference}</p><h1 id="ticket-detail-title" className="mt-2 text-3xl font-bold">{ticket.title}</h1><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Status</dt><dd className="font-medium">{ticket.status}</dd></div><div><dt className="text-sm text-slate-500">Priority</dt><dd className="font-medium">{ticket.priority}</dd></div><div><dt className="text-sm text-slate-500">Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div><div><dt className="text-sm text-slate-500">Last updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div></dl><div className="mt-6 border-t pt-5"><h2 className="text-lg font-semibold">Description</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{ticket.description}</p></div></div>
      <div><h2 className="text-2xl font-bold">Activity</h2>{history.length === 0 ? <p className="mt-3 text-slate-600">No activity has been recorded yet.</p> : <ol className="mt-4 space-y-3">{history.map(entry => <li key={entry.id} className="rounded border border-slate-200 bg-white p-4"><p className="font-medium">{displayEvent(entry.eventType)}</p><p className="mt-1 text-sm text-slate-600">By {entry.actor.displayName} · {new Date(entry.createdAt).toLocaleString()}</p></li>)}</ol>}</div>
    </section>
  )
}
