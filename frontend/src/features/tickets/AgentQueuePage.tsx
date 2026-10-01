import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { Panel } from '../../components/ui/Panel'
import { ApiError } from '../../api/client'
import { getAgents, getTeams, listTickets, type AgentSummary, type PageResponse, type TicketListQuery, type TicketSummary, type TicketTeamSummary } from '../../api/tickets'

const emptyFilters = { status: '', priority: '', assignedAgentId: '', teamId: '', unassignedTeam: false, myTeams: false, unassigned: false, search: '', sort: 'updatedAt,desc' }
const sortLabels: Record<string, string> = { 'updatedAt,desc': 'Updated: newest first', 'updatedAt,asc': 'Updated: oldest first', 'createdAt,desc': 'Created: newest first', 'priority,asc': 'Priority', 'status,asc': 'Status', 'title,asc': 'Title' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function titleCase(value: string) {
  return value.split('_').map(word => word[0] + word.slice(1).toLowerCase()).join(' ')
}

export function AgentQueuePage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [query, setQuery] = useState<TicketListQuery>({ sort: 'updatedAt,desc' })
  const [result, setResult] = useState<PageResponse<TicketSummary> | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [teams, setTeams] = useState<TicketTeamSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const activeFilterLabels = getActiveFilterLabels(query, agents, teams)

  useEffect(() => {
    setResult(null)
    setError(null)
    void listTickets(query).then(setResult).catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load the support queue.'))
  }, [query])

  useEffect(() => { void getAgents().then(setAgents).catch(() => setAgents([])) }, [])
  useEffect(() => { void getTeams().then(setTeams).catch(() => setTeams([])) }, [])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery({
      status: filters.status as TicketListQuery['status'] || undefined,
      priority: filters.priority as TicketListQuery['priority'] || undefined,
      assignedAgentId: filters.assignedAgentId || undefined,
      teamId: filters.teamId || undefined,
      unassignedTeam: filters.unassignedTeam || undefined,
      myTeams: filters.myTeams || undefined,
      unassigned: filters.unassigned || undefined,
      search: filters.search.trim() || undefined,
      sort: filters.sort,
      page: 0
    })
  }

  function resetFilters() {
    setFilters(emptyFilters)
    setQuery({ sort: 'updatedAt,desc', page: 0 })
  }

  return <section className="space-y-6" aria-labelledby="queue-title" aria-busy={result === null && !error}>
    <PageHeader id="queue-title" eyebrow="Support operations" title="Ticket queue" meta={result ? `${result.totalElements} ${result.totalElements === 1 ? 'case' : 'cases'}` : undefined}>
      Triage, route, and progress customer requests from one focused workspace.
    </PageHeader>

    <Panel className="border-slate-300 p-4 sm:p-5">
      <form className="space-y-5" onSubmit={applyFilters}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="rd-label" htmlFor="queue-search">Search tickets</label>
            <input id="queue-search" className="rd-input" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Reference or title" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" disabled={activeFilterLabels.length === 0} onClick={resetFilters}>Clear filters</Button>
            <Button type="submit">Apply filters</Button>
          </div>
        </div>

        <fieldset className="border-t border-slate-200 pt-4">
          <legend className="rd-meta-label px-0">Refine queue</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <FilterSelect id="queue-status" label="Status" value={filters.status} onChange={value => setFilters(current => ({ ...current, status: value }))}>
              <option value="">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
            </FilterSelect>
            <FilterSelect id="queue-priority" label="Priority" value={filters.priority} onChange={value => setFilters(current => ({ ...current, priority: value }))}>
              <option value="">All priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </FilterSelect>
            <FilterSelect id="queue-team" label="Team" value={filters.teamId} disabled={filters.unassignedTeam || filters.myTeams} onChange={value => setFilters(current => ({ ...current, teamId: value, unassignedTeam: false, myTeams: false }))}>
              <option value="">All teams</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </FilterSelect>
            <FilterSelect id="queue-assignee" label="Assigned agent" value={filters.assignedAgentId} disabled={filters.unassigned} onChange={value => setFilters(current => ({ ...current, assignedAgentId: value }))}>
              <option value="">All assigned agents</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}
            </FilterSelect>
            <FilterSelect id="queue-sort" label="Sort" value={filters.sort} onChange={value => setFilters(current => ({ ...current, sort: value }))}>
              <option value="updatedAt,desc">Updated, newest first</option><option value="updatedAt,asc">Updated, oldest first</option><option value="createdAt,desc">Created, newest first</option><option value="priority,asc">Priority</option><option value="status,asc">Status</option><option value="title,asc">Title</option>
            </FilterSelect>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterToggle id="queue-unassigned" checked={filters.unassigned} onChange={checked => setFilters(current => ({ ...current, unassigned: checked, assignedAgentId: checked ? '' : current.assignedAgentId }))}>Unassigned only</FilterToggle>
            <FilterToggle id="queue-my-teams" checked={filters.myTeams} onChange={checked => setFilters(current => ({ ...current, myTeams: checked, teamId: checked ? '' : current.teamId, unassignedTeam: checked ? false : current.unassignedTeam }))}>My Teams</FilterToggle>
            <FilterToggle id="queue-unassigned-team" checked={filters.unassignedTeam} onChange={checked => setFilters(current => ({ ...current, unassignedTeam: checked, teamId: checked ? '' : current.teamId, myTeams: checked ? false : current.myTeams }))}>Unrouted / No team</FilterToggle>
          </div>
        </fieldset>
      </form>
    </Panel>

    {activeFilterLabels.length > 0 && <AppliedFilters filters={activeFilterLabels} onClear={resetFilters} />}
    {error && <Alert tone="danger">{error}</Alert>}
    {result === null && !error && <LoadingState label="Loading support queue…" />}
    {result && (result.content.length === 0 ? <EmptyState title="No matching tickets">Try clearing or adjusting the current filters.</EmptyState> : <><QueueResults tickets={result.content} /><Pagination first={result.first} last={result.last} page={result.page} totalPages={result.totalPages} onPageChange={page => setQuery(current => ({ ...current, page }))} /></>)}
  </section>
}

function getActiveFilterLabels(query: TicketListQuery, agents: AgentSummary[], teams: TicketTeamSummary[]) {
  const labels: string[] = []
  if (query.search) labels.push(`Search: ${query.search}`)
  if (query.status) labels.push(`Status: ${titleCase(query.status)}`)
  if (query.priority) labels.push(`Priority: ${titleCase(query.priority)}`)
  if (query.teamId) labels.push(`Team: ${teams.find(team => String(team.id) === query.teamId)?.name ?? `#${query.teamId}`}`)
  if (query.unassignedTeam) labels.push('Unrouted tickets')
  if (query.myTeams) labels.push('My Teams')
  if (query.assignedAgentId) labels.push(`Assignee: ${agents.find(agent => String(agent.id) === query.assignedAgentId)?.displayName ?? `#${query.assignedAgentId}`}`)
  if (query.unassigned) labels.push('Unassigned tickets')
  if (query.sort && query.sort !== 'updatedAt,desc') labels.push(sortLabels[query.sort] ?? query.sort)
  return labels
}

function FilterSelect({ children, disabled, id, label, onChange, value }: { children: ReactNode; disabled?: boolean; id: string; label: string; onChange: (value: string) => void; value: string }) {
  return <div><label className="rd-label" htmlFor={id}>{label}</label><select id={id} className="rd-select" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select></div>
}

function FilterToggle({ checked, children, id, onChange }: { checked: boolean; children: ReactNode; id: string; onChange: (checked: boolean) => void }) {
  return <label className="rd-filter-toggle"><input id={id} className="rd-checkbox" type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />{children}</label>
}

function AppliedFilters({ filters, onClear }: { filters: string[]; onClear: () => void }) {
  return <section aria-label="Applied queue filters" className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3"><p className="text-sm font-semibold text-slate-800">Applied filters <span className="font-normal text-slate-600">({filters.length})</span></p><ul className="flex flex-1 flex-wrap gap-2">{filters.map(filter => <li key={filter} className="rounded-md border border-sky-100 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{filter}</li>)}</ul><Button variant="quiet" className="min-h-9 px-3 text-xs" onClick={onClear}>Clear all</Button></section>
}

function QueueResults({ tickets }: { tickets: TicketSummary[] }) {
  return <Panel className="overflow-hidden border-slate-300 p-0">
    <div className="hidden overflow-x-auto lg:block">
      <table className="min-w-full text-left">
        <thead className="border-b border-slate-200 bg-slate-50 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><tr><th scope="col" className="px-5 py-3">Case</th><th scope="col" className="px-5 py-3">Customer request</th><th scope="col" className="px-5 py-3">Status</th><th scope="col" className="px-5 py-3">Priority</th><th scope="col" className="px-5 py-3">Routing</th><th scope="col" className="px-5 py-3">Assignee</th><th scope="col" className="px-5 py-3">Last activity</th></tr></thead>
        <tbody className="divide-y divide-slate-200">{tickets.map(ticket => <tr key={ticket.id} className="group transition-colors hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 align-top"><Link className="rd-case-reference rounded-sm hover:underline focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.reference}</Link></td><td className="min-w-[20rem] px-5 py-4 align-top"><Link className="block rounded-sm text-sm font-semibold text-slate-950 transition-colors group-hover:text-sky-800 focus-visible:outline-sky-700" to={`/tickets/${ticket.id}`}>{ticket.title}</Link><p className="mt-1 text-sm text-slate-600">{ticket.customer.displayName}</p></td><td className="px-5 py-4 align-top"><StatusBadge status={ticket.status} /></td><td className="px-5 py-4 align-top"><PriorityBadge priority={ticket.priority} /></td><td className="px-5 py-4 align-top"><AssignmentValue label="Team" value={ticket.assignedTeam?.name} empty="No team" /></td><td className="px-5 py-4 align-top"><AssignmentValue label="Owner" value={ticket.assignedAgent?.displayName} empty="Unassigned" /></td><td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-600">{formatDate(ticket.updatedAt)}</td></tr>)}</tbody>
      </table>
    </div>
    <ul className="divide-y divide-slate-200 lg:hidden">{tickets.map(ticket => <li key={ticket.id}><Link className="block px-4 py-5 transition-colors hover:bg-slate-50 focus-visible:outline-sky-700 sm:px-5" to={`/tickets/${ticket.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="rd-case-reference">{ticket.reference}</p><p className="mt-1 text-base font-semibold leading-6 text-slate-950">{ticket.title}</p><p className="mt-1 text-sm text-slate-600">{ticket.customer.displayName}</p></div><div className="shrink-0"><StatusBadge status={ticket.status} /></div></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4"><AssignmentValue label="Team" value={ticket.assignedTeam?.name} empty="No team" /><AssignmentValue label="Owner" value={ticket.assignedAgent?.displayName} empty="Unassigned" /><div><p className="rd-meta-label">Priority</p><div className="mt-1"><PriorityBadge priority={ticket.priority} /></div></div><div><p className="rd-meta-label">Last activity</p><p className="mt-1 text-xs leading-5 text-slate-600">{formatDate(ticket.updatedAt)}</p></div></div></Link></li>)}</ul>
  </Panel>
}

function AssignmentValue({ empty, label, value }: { empty: string; label: string; value?: string }) {
  return <div><p className="rd-meta-label">{label}</p>{value ? <p className="mt-1 text-sm font-medium text-slate-800">{value}</p> : <p className="rd-empty-assignment mt-1"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-300" />{empty}</p>}</div>
}
