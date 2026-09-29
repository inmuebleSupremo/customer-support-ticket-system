import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { changeTicketAssignee, changeTicketStatus, getAgents, getTicket, getTicketHistory, type AgentSummary, type TicketDetail, type TicketHistoryEntry } from '../../api/tickets'
import { useAuth } from '../auth/AuthContext'

function displayEvent(eventType: TicketHistoryEntry['eventType']) {
  return eventType.split('_').map(word => word[0] + word.slice(1).toLowerCase()).join(' ')
}

export function TicketDetailPage() {
  const { user } = useAuth()
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [history, setHistory] = useState<TicketHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)

  const loadTicket = useCallback(async () => {
    if (!ticketId) return
    try {
      const [ticketResponse, historyResponse] = await Promise.all([getTicket(ticketId), getTicketHistory(ticketId)])
      setTicket(ticketResponse)
      setHistory(historyResponse)
      setSelectedAgentId(ticketResponse.assignedAgent?.id.toString() ?? '')
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to load this ticket.')
    }
  }, [ticketId])

  useEffect(() => { void loadTicket() }, [loadTicket])

  useEffect(() => {
    if (user?.role === 'AGENT' || user?.role === 'ADMIN') {
      void getAgents().then(setAgents).catch(() => setAgents([]))
    }
  }, [user?.role])

  async function handleAssignment(agentId = selectedAgentId === '' ? null : Number(selectedAgentId)) {
    if (!ticket) return
    setMutationError(null)
    try {
      await changeTicketAssignee(ticket.id, agentId, ticket.version)
      await loadTicket()
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.problem.code === 'STALE_RESOURCE') {
        setMutationError('This ticket changed while you were viewing it. The latest version has been loaded.')
        await loadTicket()
      } else {
        setMutationError(requestError instanceof ApiError ? requestError.message : 'Unable to update the ticket assignment.')
      }
    }
  }

  async function handleStatus(status: TicketDetail['status']) {
    if (!ticket) return
    setMutationError(null)
    try {
      await changeTicketStatus(ticket.id, status, ticket.version)
      await loadTicket()
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.problem.code === 'STALE_RESOURCE') {
        setMutationError('This ticket changed while you were viewing it. The latest version has been loaded.')
        await loadTicket()
      } else {
        setMutationError(requestError instanceof ApiError ? requestError.message : 'Unable to update the ticket status.')
      }
    }
  }

  const backTo = user?.role === 'CUSTOMER' ? '/tickets' : '/queue'
  const backLabel = user?.role === 'CUSTOMER' ? 'Back to your tickets' : 'Back to support queue'
  if (error) return <section aria-labelledby="ticket-detail-title"><h1 id="ticket-detail-title" className="text-3xl font-bold">Ticket unavailable</h1><p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-800">{error}</p><Link className="mt-4 inline-block text-sky-700 underline" to={backTo}>{backLabel}</Link></section>
  if (ticket === null || history === null) return <p role="status">Loading ticket…</p>
  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN'
  const nextStatuses: TicketDetail['status'][] = ticket.status === 'OPEN' ? ['IN_PROGRESS'] : ticket.status === 'IN_PROGRESS' ? ['OPEN', 'RESOLVED'] : ticket.status === 'RESOLVED' ? ['IN_PROGRESS', 'CLOSED'] : []
  const permittedStatuses: TicketDetail['status'][] = isStaff ? nextStatuses : user?.role === 'CUSTOMER' && ticket.status === 'RESOLVED' ? ['IN_PROGRESS'] : []

  return (
    <section aria-labelledby="ticket-detail-title" className="mx-auto max-w-3xl space-y-8">
      <Link className="text-sky-700 underline" to={backTo}>{backLabel}</Link>
      <div className="rounded border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-wide text-sky-700">{ticket.reference}</p><h1 id="ticket-detail-title" className="mt-2 text-3xl font-bold">{ticket.title}</h1><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Status</dt><dd className="font-medium">{ticket.status}</dd></div><div><dt className="text-sm text-slate-500">Priority</dt><dd className="font-medium">{ticket.priority}</dd></div><div><dt className="text-sm text-slate-500">Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div><div><dt className="text-sm text-slate-500">Last updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div></dl><div className="mt-6 border-t pt-5"><h2 className="text-lg font-semibold">Description</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{ticket.description}</p></div></div>
      {mutationError && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{mutationError}</p>}
      {ticket.status !== 'CLOSED' && (isStaff || permittedStatuses.length > 0) && <section className="rounded border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="ticket-actions-title"><h2 id="ticket-actions-title" className="text-xl font-bold">Ticket actions</h2>{isStaff && <div className="mt-4"><label className="block text-sm font-medium" htmlFor="ticket-assignee">Assigned agent<select id="ticket-assignee" className="mt-1 block w-full rounded border p-2" value={selectedAgentId} onChange={event => setSelectedAgentId(event.target.value)}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select></label><div className="mt-3 flex flex-wrap gap-2"><button className="rounded bg-sky-700 px-4 py-2 font-medium text-white" type="button" onClick={() => void handleAssignment()}>Update assignment</button>{user?.role === 'AGENT' && <button className="rounded border px-4 py-2 font-medium" type="button" onClick={() => { setSelectedAgentId(user.id.toString()); void handleAssignment(user.id) }}>Assign to me</button>}</div></div>}<div className="mt-5"><h3 className="font-semibold">Change status</h3><div className="mt-2 flex flex-wrap gap-2">{permittedStatuses.map(status => <button key={status} className="rounded border px-4 py-2 font-medium" type="button" onClick={() => void handleStatus(status)}>Change status to {status.replace('_', ' ')}</button>)}</div></div></section>}
      <div><h2 className="text-2xl font-bold">Activity</h2>{history.length === 0 ? <p className="mt-3 text-slate-600">No activity has been recorded yet.</p> : <ol className="mt-4 space-y-3">{history.map(entry => <li key={entry.id} className="rounded border border-slate-200 bg-white p-4"><p className="font-medium">{displayEvent(entry.eventType)}</p><p className="mt-1 text-sm text-slate-600">By {entry.actor.displayName} · {new Date(entry.createdAt).toLocaleString()}</p></li>)}</ol>}</div>
    </section>
  )
}
