import { Link, useLocation, useParams } from 'react-router-dom'
import type { TicketDetail } from '../../api/tickets'

interface TicketCreatedState { ticket?: TicketDetail }

export function TicketCreatedPage() {
  const { ticketId } = useParams()
  const state = useLocation().state as TicketCreatedState | null
  const reference = state?.ticket?.reference ?? (ticketId ? `Ticket #${ticketId}` : 'Your ticket')

  return (
    <section aria-labelledby="ticket-created-title" className="mx-auto max-w-xl space-y-4">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Ticket submitted</p>
      <h1 id="ticket-created-title" className="text-3xl font-bold">Ticket created</h1>
      <p className="text-slate-600">{reference} was created successfully. Ticket details will be available in a later phase.</p>
      <Link className="text-sky-700 underline" to="/tickets/new">Create another ticket</Link>
    </section>
  )
}
