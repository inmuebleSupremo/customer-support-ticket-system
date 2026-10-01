import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PriorityBadge, RoleBadge, StatusBadge } from '../../components/ui/Badges'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { Panel } from '../../components/ui/Panel'
import { ApiError } from '../../api/client'
import { changeTicketAssignee, changeTicketPriority, changeTicketStatus, changeTicketTeam, createTicketComment, getAgents, getTeams, getTicket, getTicketComments, getTicketHistory, type AgentSummary, type PageResponse, type TicketComment, type TicketDetail, type TicketHistoryEntry, type TicketTeamSummary } from '../../api/tickets'
import { useAuth } from '../auth/AuthContext'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function titleCase(value: string) {
  return value.split('_').map(word => word[0] + word.slice(1).toLowerCase()).join(' ')
}

export function TicketDetailPage() {
  const { user } = useAuth()
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [history, setHistory] = useState<TicketHistoryEntry[] | null>(null)
  const [comments, setComments] = useState<PageResponse<TicketComment> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [teams, setTeams] = useState<TicketTeamSummary[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<TicketDetail['priority']>('MEDIUM')
  const [commentContent, setCommentContent] = useState('')
  const [commentValidationError, setCommentValidationError] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)
  const [commenting, setCommenting] = useState(false)

  const loadTicket = useCallback(async () => {
    if (!ticketId) return
    try {
      const [ticketResponse, historyResponse] = await Promise.all([getTicket(ticketId), getTicketHistory(ticketId)])
      setTicket(ticketResponse)
      setHistory(historyResponse)
      setSelectedAgentId(ticketResponse.assignedAgent?.id.toString() ?? '')
      setSelectedTeamId(ticketResponse.assignedTeam?.id.toString() ?? '')
      setSelectedPriority(ticketResponse.priority)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to load this ticket.')
    }
  }, [ticketId])

  const loadComments = useCallback(async () => {
    if (!ticketId) return
    try {
      setComments(await getTicketComments(ticketId))
      setCommentsError(null)
    } catch (requestError) {
      setCommentsError(requestError instanceof ApiError ? requestError.message : 'Unable to load the conversation.')
    }
  }, [ticketId])

  useEffect(() => { void loadTicket() }, [loadTicket])
  useEffect(() => { void loadComments() }, [loadComments])
  useEffect(() => {
    if (ticket && (user?.role === 'AGENT' || user?.role === 'ADMIN')) {
      void getAgents(ticket.assignedTeam?.id).then(setAgents).catch(() => setAgents([]))
      void getTeams().then(setTeams).catch(() => setTeams([]))
    }
  }, [ticket?.id, ticket?.assignedTeam?.id, user?.role])

  async function mutate(operation: () => Promise<unknown>) {
    if (!ticket) return
    setMutationError(null)
    setMutating(true)
    try {
      await operation()
      await loadTicket()
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.problem.code === 'STALE_RESOURCE') {
        setMutationError('This ticket changed while you were viewing it. The latest version has been loaded.')
        await loadTicket()
      } else {
        setMutationError(requestError instanceof ApiError ? requestError.message : 'Unable to update this ticket.')
      }
    } finally {
      setMutating(false)
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ticket) return
    const content = commentContent.trim()
    if (!content) {
      setCommentValidationError('Comment content is required.')
      return
    }
    if (content.length > 3000) {
      setCommentValidationError('Comment content must not exceed 3000 characters.')
      return
    }
    setCommentValidationError(null)
    setCommentsError(null)
    setCommenting(true)
    try {
      await createTicketComment(ticket.id, content)
      setCommentContent('')
      await Promise.all([loadTicket(), loadComments()])
    } catch (requestError) {
      setCommentsError(requestError instanceof ApiError ? requestError.message : 'Unable to add this comment.')
    } finally {
      setCommenting(false)
    }
  }

  const backTo = user?.role === 'CUSTOMER' ? '/tickets' : '/queue'
  const backLabel = user?.role === 'CUSTOMER' ? 'Back to your tickets' : 'Back to support queue'

  if (error) return <section className="mx-auto max-w-3xl space-y-4"><h1 className="text-3xl font-bold tracking-tight">Ticket unavailable</h1><Alert tone="danger">{error}</Alert><Link className="font-semibold text-sky-800 underline" to={backTo}>{backLabel}</Link></section>
  if (!ticket || !history) return <LoadingState label="Loading ticket…" />

  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN'
  const nextStatuses: TicketDetail['status'][] = ticket.status === 'OPEN' ? ['IN_PROGRESS'] : ticket.status === 'IN_PROGRESS' ? ['OPEN', 'RESOLVED'] : ticket.status === 'RESOLVED' ? ['IN_PROGRESS', 'CLOSED'] : []
  const permittedStatuses: TicketDetail['status'][] = isStaff ? nextStatuses : user?.role === 'CUSTOMER' && ticket.status === 'RESOLVED' ? ['IN_PROGRESS'] : []

  return <section className="mx-auto max-w-7xl space-y-6" aria-labelledby="ticket-detail-title" aria-busy={mutating}>
    <Link className="inline-flex min-h-11 items-center font-semibold text-sky-800 underline underline-offset-2" to={backTo}>{backLabel}</Link>
    <header className="border-b border-slate-200 pb-6 sm:pb-7">
      <p className="rd-case-reference">{ticket.reference}</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="ticket-detail-title" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">{ticket.title}</h1>
          <p className="mt-2 text-sm text-slate-600">Customer: <span className="font-medium text-slate-800">{ticket.customer.displayName}</span></p>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
        </div>
        {ticket.status === 'CLOSED' && <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Closed tickets are read-only.</p>}
      </div>
    </header>
    {mutationError && <Alert tone="danger">{mutationError}</Alert>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <main className="min-w-0 space-y-6">
        <Panel className="border-slate-300"><p className="rd-meta-label">Customer request</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Description</h2><p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{ticket.description}</p></Panel>
        <Conversation comments={comments} error={commentsError} content={commentContent} validationError={commentValidationError} closed={ticket.status === 'CLOSED'} commenting={commenting} onChange={setCommentContent} onSubmit={submitComment} />
        <ActivityTimeline history={history} />
      </main>
      <aside className="space-y-5 lg:sticky lg:top-6">
        <TicketMetadata ticket={ticket} />
        {ticket.status !== 'CLOSED' && (isStaff || permittedStatuses.length > 0) && <TicketActions ticket={ticket} isStaff={isStaff} isAgent={user?.role === 'AGENT'} currentUserId={user?.id} canAssignSelf={!ticket.assignedTeam || agents.some(agent => agent.id === user?.id)} agents={agents} teams={teams} agentId={selectedAgentId} teamId={selectedTeamId} priority={selectedPriority} statuses={permittedStatuses} mutating={mutating} onAgentChange={setSelectedAgentId} onTeamChange={setSelectedTeamId} onPriorityChange={setSelectedPriority} onAssign={() => void mutate(() => changeTicketAssignee(ticket.id, selectedAgentId === '' ? null : Number(selectedAgentId), ticket.version))} onRoute={() => void mutate(() => changeTicketTeam(ticket.id, selectedTeamId === '' ? null : Number(selectedTeamId), ticket.version))} onAssignSelf={() => { setSelectedAgentId(String(user?.id)); void mutate(() => changeTicketAssignee(ticket.id, user?.id ?? null, ticket.version)) }} onPriority={() => void mutate(() => changeTicketPriority(ticket.id, selectedPriority, ticket.version))} onStatus={status => void mutate(() => changeTicketStatus(ticket.id, status, ticket.version))} />}
      </aside>
    </div>
  </section>
}

function TicketMetadata({ ticket }: { ticket: TicketDetail }) {
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: 'Customer', value: ticket.customer.displayName, wide: true },
    { label: 'Assigned agent', value: ticket.assignedAgent?.displayName ?? 'Unassigned' },
    { label: 'Assigned team', value: ticket.assignedTeam?.name ?? 'Unrouted' },
    { label: 'Created', value: formatDate(ticket.createdAt) },
    { label: 'Last activity', value: formatDate(ticket.updatedAt) },
    ...(ticket.resolvedAt ? [{ label: 'Resolved', value: formatDate(ticket.resolvedAt) }] : []),
    ...(ticket.closedAt ? [{ label: 'Closed', value: formatDate(ticket.closedAt) }] : [])
  ]
  return <Panel className="border-slate-300 p-5"><p className="rd-meta-label">Case context</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Ticket details</h2><dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">{rows.map(row => <div key={row.label} className={`bg-white px-3 py-3 ${row.wide ? 'col-span-2' : ''}`}><dt className="rd-meta-label">{row.label}</dt><dd className="mt-1 break-words text-sm font-medium leading-5 text-slate-800">{row.value}</dd></div>)}</dl></Panel>
}

function TicketActions({ agentId, agents, canAssignSelf, currentUserId, isAgent, isStaff, mutating, onAgentChange, onAssign, onAssignSelf, onPriority, onPriorityChange, onRoute, onStatus, onTeamChange, priority, statuses, teamId, teams, ticket }: { agentId: string; agents: AgentSummary[]; canAssignSelf: boolean; currentUserId?: number; isAgent: boolean; isStaff: boolean; mutating: boolean; onAgentChange: (value: string) => void; onAssign: () => void; onAssignSelf: () => void; onPriority: () => void; onPriorityChange: (value: TicketDetail['priority']) => void; onRoute: () => void; onStatus: (status: TicketDetail['status']) => void; onTeamChange: (value: string) => void; priority: TicketDetail['priority']; statuses: TicketDetail['status'][]; teamId: string; teams: TicketTeamSummary[]; ticket: TicketDetail }) {
  return <Panel className="border-slate-300 p-5">
    <p className="rd-meta-label">Operational controls</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Ticket actions</h2><p className="mt-1 text-sm leading-5 text-slate-600">Changes are applied to the current ticket version.</p>
    <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
      {isStaff && <><OperationSection title="Ownership" description="Set the accountable support agent."><label className="rd-label" htmlFor="ticket-assignee">Assigned agent</label><select id="ticket-assignee" className="rd-select" value={agentId} disabled={mutating} onChange={event => onAgentChange(event.target.value)}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button className="w-full sm:w-auto" disabled={mutating} onClick={onAssign}>Update assignment</Button>{isAgent && <Button className="w-full sm:w-auto" variant="secondary" disabled={mutating || !canAssignSelf || ticket.assignedAgent?.id === currentUserId} onClick={onAssignSelf}>Assign to me</Button>}</div></OperationSection>
        <OperationSection title="Routing" description="Route the ticket to its supporting team."><label className="rd-label" htmlFor="ticket-team">Assigned team</label><select id="ticket-team" className="rd-select" value={teamId} disabled={mutating} onChange={event => onTeamChange(event.target.value)}><option value="">Unrouted</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><Button className="mt-3 w-full sm:w-auto" variant="secondary" disabled={mutating} onClick={onRoute}>Update team</Button></OperationSection>
        <OperationSection title="Priority" description="Set the response urgency for this case."><div className="mb-2"><PriorityBadge priority={priority} /></div><label className="rd-label" htmlFor="ticket-priority">Priority</label><select id="ticket-priority" className="rd-select" value={priority} disabled={mutating} onChange={event => onPriorityChange(event.target.value as TicketDetail['priority'])}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select><Button className="mt-3 w-full sm:w-auto" variant="secondary" disabled={mutating} onClick={onPriority}>Update priority</Button></OperationSection></>}
      {statuses.length > 0 && <OperationSection title="Workflow" description="Only valid next actions are available."><div className="flex flex-col gap-2">{statuses.map(status => <Button key={status} className="w-full" variant={status === 'CLOSED' ? 'danger' : 'secondary'} disabled={mutating} onClick={() => onStatus(status)}>Change status to {titleCase(status)}</Button>)}</div></OperationSection>}
    </div>
  </Panel>
}

function OperationSection({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return <section className="py-5 first:pt-0 last:pb-0"><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p><div className="mt-3">{children}</div></section>
}

function Conversation({ closed, commenting, comments, content, error, onChange, onSubmit, validationError }: { closed: boolean; commenting: boolean; comments: PageResponse<TicketComment> | null; content: string; error: string | null; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; validationError: string | null }) {
  return <Panel className="border-slate-300 p-0"><div className="border-b border-slate-200 px-5 py-5 sm:px-6"><p className="rd-meta-label">Ticket conversation</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Conversation</h2><p className="mt-1 text-sm text-slate-600">Messages are recorded in chronological order.</p></div><div className="px-5 py-5 sm:px-6">{error && <Alert tone="danger">{error}</Alert>}{comments === null && !error && <LoadingState label="Loading conversation…" />}{comments && (comments.content.length === 0 ? <EmptyState title="No conversation yet">The first reply will appear here.</EmptyState> : <ol aria-label="Conversation messages" className="space-y-3">{comments.content.map(comment => <CommentMessage key={comment.id} comment={comment} />)}</ol>)}{closed ? <p className="mt-5 border-t border-slate-200 pt-5 text-sm font-medium text-slate-600">This conversation is read-only because the ticket is closed.</p> : <form className="mt-6 border-t border-slate-200 pt-5" onSubmit={onSubmit} aria-busy={commenting}><h3 className="text-sm font-semibold text-slate-900">Add a reply</h3><label className="sr-only" htmlFor="comment-content">Add a comment</label><textarea id="comment-content" className="rd-textarea mt-3 min-h-32" value={content} onChange={event => onChange(event.target.value)} maxLength={3000} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? 'comment-content-error' : undefined} />{validationError && <p id="comment-content-error" className="rd-validation-message" role="alert">{validationError}</p>}<Button className="mt-3 w-full sm:w-auto" type="submit" disabled={commenting}>{commenting ? 'Adding comment…' : 'Add comment'}</Button></form>}</div></Panel>
}

function CommentMessage({ comment }: { comment: TicketComment }) {
  const isCustomer = comment.author.role === 'CUSTOMER'
  return <li className={`rounded-lg border px-4 py-4 sm:px-5 ${isCustomer ? 'border-slate-200 bg-white' : 'border-sky-200 bg-sky-50/50'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{comment.author.displayName}</p><RoleBadge role={comment.author.role} /><span className="text-xs font-medium text-slate-500">{isCustomer ? 'Customer message' : 'Staff reply'}</span></div><p className="shrink-0 text-xs text-slate-500">{formatDate(comment.createdAt)}</p></div><p className="mt-3 whitespace-pre-wrap leading-6 text-slate-700">{comment.content}</p></li>
}

function ActivityTimeline({ history }: { history: TicketHistoryEntry[] }) {
  return <Panel className="border-slate-300"><p className="rd-meta-label">Case history</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Activity</h2>{history.length === 0 ? <p className="mt-4 text-sm text-slate-600">No activity has been recorded yet.</p> : <ol className="mt-5 space-y-0 border-l border-slate-200">{history.map(entry => <ActivityEntry key={entry.id} entry={entry} />)}</ol>}</Panel>
}

function ActivityEntry({ entry }: { entry: TicketHistoryEntry }) {
  const labels: Record<TicketHistoryEntry['eventType'], string> = { TICKET_CREATED: 'Ticket created', STATUS_CHANGED: 'Status changed', PRIORITY_CHANGED: 'Priority changed', ASSIGNMENT_CHANGED: 'Assignment changed', TEAM_CHANGED: 'Team changed' }
  const valuesChanged = entry.oldDisplayValue && entry.newDisplayValue
  return <li className="relative pb-6 pl-5 last:pb-0"><span aria-hidden="true" className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-700" /><p className="rd-meta-label">{labels[entry.eventType]}</p><p className="mt-1 text-sm font-medium text-slate-900">By {entry.actor.displayName}</p>{valuesChanged && <p className="mt-1 text-sm text-slate-700"><span className="text-slate-500">{entry.oldDisplayValue}</span><span aria-hidden="true" className="px-1.5 text-slate-400">→</span><span>{entry.newDisplayValue}</span></p>}<p className="mt-1 text-xs text-slate-500">{formatDate(entry.createdAt)}</p></li>
}
