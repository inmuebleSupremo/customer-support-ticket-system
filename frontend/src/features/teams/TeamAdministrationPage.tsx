import { type FormEvent, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { addTeamMember, changeTeamActive, changeTeamName, createTeam, getAgents, getTeam, getTeams, removeTeamMember, type AgentSummary, type TeamAdministrationDetail, type TeamMember, type TicketTeamSummary } from '../../api/tickets'
import { AccountStatusBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'

function teamMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Unable to update the team status.'
  if (error.problem.code === 'TEAM_HAS_ACTIVE_TICKETS') return error.problem.detail ?? 'Reassign or clear this team’s non-closed tickets before deactivating it.'
  return error.message
}

function membershipMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Unable to update team membership.'
  if (error.problem.code === 'TEAM_MEMBER_HAS_ACTIVE_TICKETS') return error.problem.detail ?? "Reassign, unassign, or route the member's non-closed team tickets before removing membership."
  return error.message
}

export function TeamAdministrationPage() {
  const [teams, setTeams] = useState<TicketTeamSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [teamBeingRenamed, setTeamBeingRenamed] = useState<TicketTeamSummary | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameNameError, setRenameNameError] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [statusErrors, setStatusErrors] = useState<Record<number, string>>({})
  const [updatingTeamId, setUpdatingTeamId] = useState<number | null>(null)
  const [teamBeingDeactivated, setTeamBeingDeactivated] = useState<TicketTeamSummary | null>(null)
  const [teamBeingManaged, setTeamBeingManaged] = useState<TicketTeamSummary | null>(null)
  const [teamDetail, setTeamDetail] = useState<TeamAdministrationDetail | null>(null)
  const [eligibleAgents, setEligibleAgents] = useState<AgentSummary[] | null>(null)
  const [membershipLoadError, setMembershipLoadError] = useState<string | null>(null)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [updatingMembership, setUpdatingMembership] = useState(false)
  const cancelDeactivationRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const loadTeams = useCallback(async () => {
    try {
      setTeams(await getTeams(true))
      setLoadError(null)
    } catch (requestError) {
      setLoadError(requestError instanceof ApiError ? requestError.message : 'Unable to load teams.')
    }
  }, [])

  useEffect(() => { void loadTeams() }, [loadTeams])

  useEffect(() => {
    if (!teamBeingDeactivated) return
    cancelDeactivationRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDeactivationConfirmation() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [teamBeingDeactivated])

  useEffect(() => {
    if (!teamBeingManaged) return
    let current = true
    void Promise.all([getTeam(teamBeingManaged.id), getAgents()]).then(([detail, agents]) => {
      if (!current) return
      setTeamDetail(detail)
      setEligibleAgents(agents)
      setMembershipLoadError(null)
    }).catch(requestError => {
      if (!current) return
      setMembershipLoadError(requestError instanceof ApiError ? requestError.message : 'Unable to load team membership.')
    })
    return () => { current = false }
  }, [teamBeingManaged])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    setNameError(null)
    setCreateError(null)
    if (!normalizedName) {
      setNameError('Team name is required.')
      return
    }
    setCreating(true)
    try {
      await createTeam({ name: normalizedName })
      setName('')
      await loadTeams()
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setNameError(requestError.problem.fieldErrors?.name ?? null)
        setCreateError(requestError.message)
      } else setCreateError('Unable to create the team.')
    } finally {
      setCreating(false)
    }
  }

  function beginRename(team: TicketTeamSummary) {
    setTeamBeingRenamed(team)
    setRenameName(team.name)
    setRenameNameError(null)
    setRenameError(null)
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamBeingRenamed) return
    const normalizedName = renameName.trim()
    setRenameNameError(null)
    setRenameError(null)
    if (!normalizedName) {
      setRenameNameError('Team name is required.')
      return
    }
    setRenaming(true)
    try {
      await changeTeamName(teamBeingRenamed.id, { name: normalizedName })
      setTeamBeingRenamed(null)
      setRenameName('')
      await loadTeams()
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setRenameNameError(requestError.problem.fieldErrors?.name ?? null)
        setRenameError(requestError.message)
      } else setRenameError('Unable to rename the team.')
    } finally {
      setRenaming(false)
    }
  }

  function openDeactivationConfirmation(team: TicketTeamSummary) {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setTeamBeingDeactivated(team)
  }

  function closeDeactivationConfirmation() {
    setTeamBeingDeactivated(null)
    window.requestAnimationFrame(() => previousFocusRef.current?.focus())
  }

  async function updateActive(team: TicketTeamSummary) {
    setUpdatingTeamId(team.id)
    setStatusErrors(current => { const { [team.id]: removed, ...remaining } = current; return remaining })
    try {
      await changeTeamActive(team.id, !team.active)
      await loadTeams()
    } catch (requestError) {
      setStatusErrors(current => ({ ...current, [team.id]: teamMessage(requestError) }))
    } finally {
      setUpdatingTeamId(null)
      if (team.active) closeDeactivationConfirmation()
    }
  }

  function beginMembershipManagement(team: TicketTeamSummary) {
    setTeamBeingManaged(team)
    setTeamDetail(null)
    setEligibleAgents(null)
    setMembershipLoadError(null)
    setMembershipError(null)
    setSelectedAgentId('')
  }

  async function addMember() {
    if (!teamDetail || !selectedAgentId) return
    setUpdatingMembership(true)
    setMembershipError(null)
    try {
      setTeamDetail(await addTeamMember(teamDetail.id, Number(selectedAgentId)))
      setSelectedAgentId('')
    } catch (requestError) {
      setMembershipError(membershipMessage(requestError))
    } finally {
      setUpdatingMembership(false)
    }
  }

  async function removeMember(member: TeamMember) {
    if (!teamDetail) return
    setUpdatingMembership(true)
    setMembershipError(null)
    try {
      setTeamDetail(await removeTeamMember(teamDetail.id, member.id))
    } catch (requestError) {
      setMembershipError(membershipMessage(requestError))
    } finally {
      setUpdatingMembership(false)
    }
  }

  return <section aria-labelledby="team-administration-title" className="space-y-6">
    <PageHeader id="team-administration-title" eyebrow="Operations administration" title="Team administration" meta={teams ? `${teams.length} ${teams.length === 1 ? 'team' : 'teams'}` : undefined}>Maintain the support teams available for ticket routing and ownership.</PageHeader>
    <TeamCreatePanel creating={creating} error={createError} name={name} nameError={nameError} onNameChange={value => { setName(value); setNameError(null); setCreateError(null) }} onSubmit={create} />
    {teamBeingRenamed && <TeamRenamePanel error={renameError} name={renameName} nameError={renameNameError} onCancel={() => setTeamBeingRenamed(null)} onNameChange={value => { setRenameName(value); setRenameNameError(null); setRenameError(null) }} onSubmit={rename} renaming={renaming} team={teamBeingRenamed} />}
    {teamBeingManaged && <MembershipPanel agents={eligibleAgents} error={membershipError} loadError={membershipLoadError} onAdd={() => void addMember()} onClose={() => setTeamBeingManaged(null)} onRemove={member => void removeMember(member)} onSelectedAgentChange={setSelectedAgentId} selectedAgentId={selectedAgentId} team={teamDetail ?? teamBeingManaged} updating={updatingMembership} />}
    {loadError && <Alert tone="danger">{loadError}</Alert>}
    {teams === null && !loadError && <LoadingState label="Loading teams…" />}
    {teams && (teams.length === 0 ? <EmptyState title="No teams yet">Support teams will appear here when they are created.</EmptyState> : <TeamResults teams={teams} mutationErrors={statusErrors} onActiveUpdate={team => team.active ? openDeactivationConfirmation(team) : void updateActive(team)} onManageMembers={beginMembershipManagement} onRename={beginRename} updatingTeamId={updatingTeamId} />)}
    {teamBeingDeactivated && <DeactivationConfirmation cancelRef={cancelDeactivationRef} onCancel={closeDeactivationConfirmation} onConfirm={() => void updateActive(teamBeingDeactivated)} team={teamBeingDeactivated} updating={updatingTeamId === teamBeingDeactivated.id} />}
  </section>
}

function TeamCreatePanel({ creating, error, name, nameError, onNameChange, onSubmit }: { creating: boolean; error: string | null; name: string; nameError: string | null; onNameChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Panel className="border-slate-300"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rd-meta-label">Team setup</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Create a team</h2><p className="mt-1 text-sm text-slate-600">New active teams are immediately available for routing.</p></div></div><form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate onSubmit={onSubmit} aria-busy={creating}><div className="min-w-0 flex-1"><label className="rd-label" htmlFor="team-name">Team name</label><input id="team-name" className="rd-input" value={name} onChange={event => onNameChange(event.target.value)} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'team-name-error' : undefined} />{nameError && <p id="team-name-error" className="rd-validation-message">{nameError}</p>}</div><Button className="w-full sm:w-auto" type="submit" disabled={creating} aria-busy={creating}>{creating ? 'Creating team…' : 'Create team'}</Button></form>{error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}</Panel>
}

function TeamRenamePanel({ error, name, nameError, onCancel, onNameChange, onSubmit, renaming, team }: { error: string | null; name: string; nameError: string | null; onCancel: () => void; onNameChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; renaming: boolean; team: TicketTeamSummary }) {
  return <Panel className="border-sky-200"><p className="rd-meta-label">Team identity</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Rename {team.name}</h2><form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate onSubmit={onSubmit} aria-busy={renaming}><div className="min-w-0 flex-1"><label className="rd-label" htmlFor="rename-team-name">Rename {team.name}</label><input id="rename-team-name" className="rd-input" value={name} onChange={event => onNameChange(event.target.value)} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'rename-team-name-error' : undefined} />{nameError && <p id="rename-team-name-error" className="rd-validation-message">{nameError}</p>}</div><div className="flex flex-col gap-2 sm:flex-row"><Button className="w-full sm:w-auto" type="button" variant="secondary" disabled={renaming} onClick={onCancel}>Cancel</Button><Button className="w-full sm:w-auto" type="submit" disabled={renaming} aria-busy={renaming}>{renaming ? 'Renaming team…' : 'Rename team'}</Button></div></form>{error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}</Panel>
}

function TeamResults({ mutationErrors, onActiveUpdate, onManageMembers, onRename, teams, updatingTeamId }: { mutationErrors: Record<number, string>; onActiveUpdate: (team: TicketTeamSummary) => void; onManageMembers: (team: TicketTeamSummary) => void; onRename: (team: TicketTeamSummary) => void; teams: TicketTeamSummary[]; updatingTeamId: number | null }) {
  const actions = (team: TicketTeamSummary) => <TeamActions error={mutationErrors[team.id]} onActiveUpdate={() => onActiveUpdate(team)} onManageMembers={() => onManageMembers(team)} onRename={() => onRename(team)} team={team} updating={updatingTeamId === team.id} />
  return <Panel className="overflow-hidden border-slate-300 p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><tr><th scope="col" className="px-5 py-3">Team</th><th scope="col" className="px-5 py-3">Routing state</th><th scope="col" className="px-5 py-3">Administration</th></tr></thead><tbody className="divide-y divide-slate-200">{teams.map(team => <tr key={team.id} className="align-top transition-colors hover:bg-slate-50"><td className="min-w-[16rem] px-5 py-4"><p className="font-semibold text-slate-950">{team.name}</p><p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Team #{team.id}</p></td><td className="min-w-[14rem] px-5 py-4"><TeamStatus team={team} /></td><td className="min-w-[26rem] px-5 py-4">{actions(team)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{teams.map(team => <li key={team.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{team.name}</p><p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Team #{team.id}</p></div><AccountStatusBadge active={team.active} /></div><div className="mt-4 border-t border-slate-100 pt-4"><TeamStatus team={team} compact /></div>{actions(team)}</li>)}</ul></Panel>
}

function TeamStatus({ compact = false, team }: { compact?: boolean; team: TicketTeamSummary }) {
  return <div className={compact ? '' : 'space-y-1'}>{!compact && <AccountStatusBadge active={team.active} />}<p className={`text-sm ${compact ? 'text-slate-600' : 'text-slate-600'}`}>{team.active ? 'Available for new ticket routing.' : 'Inactive and unavailable for new routing.'}</p></div>
}

function TeamActions({ error, onActiveUpdate, onManageMembers, onRename, team, updating }: { error?: string; onActiveUpdate: () => void; onManageMembers: () => void; onRename: () => void; team: TicketTeamSummary; updating: boolean }) {
  return <div className="mt-4 lg:mt-0"><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button className="w-full sm:w-auto" variant="secondary" disabled={updating} onClick={onManageMembers}>Manage members {team.name}</Button><Button className="w-full sm:w-auto" variant="quiet" disabled={updating} onClick={onRename}>Rename {team.name}</Button><Button className="w-full sm:w-auto" variant="quiet" disabled={updating} onClick={onActiveUpdate}>{team.active ? `Deactivate ${team.name}` : `Reactivate ${team.name}`}</Button></div>{error && <div className="mt-3"><p className="rd-meta-label">Action needs attention</p><div className="mt-1"><Alert tone="danger">{error}</Alert></div></div>}</div>
}

function MembershipPanel({ agents, error, loadError, onAdd, onClose, onRemove, onSelectedAgentChange, selectedAgentId, team, updating }: { agents: AgentSummary[] | null; error: string | null; loadError: string | null; onAdd: () => void; onClose: () => void; onRemove: (member: TeamMember) => void; onSelectedAgentChange: (id: string) => void; selectedAgentId: string; team: TicketTeamSummary | TeamAdministrationDetail; updating: boolean }) {
  const members = 'members' in team ? team.members : null
  const availableAgents = agents?.filter(agent => !members?.some(member => member.id === agent.id)) ?? []
  return <Panel className="border-slate-300"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rd-meta-label">Membership management</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Members of {team.name}</h2><p className="mt-1 text-sm leading-5 text-slate-600">Manage the active agents who can work this team’s routed tickets.</p></div><Button type="button" variant="quiet" disabled={updating} onClick={onClose}>Close members</Button></div>{loadError && <div className="mt-4"><Alert tone="danger">{loadError}</Alert></div>}{members === null && !loadError && <div className="mt-5"><LoadingState label="Loading team members…" /></div>}{members && <><section className="mt-5 border-t border-slate-200 pt-5" aria-labelledby="add-member-title"><h3 id="add-member-title" className="text-sm font-semibold text-slate-900">Add an agent</h3><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label className="rd-label" htmlFor="team-member-agent">Add an agent to {team.name}</label><select id="team-member-agent" className="rd-select" value={selectedAgentId} disabled={updating} onChange={event => onSelectedAgentChange(event.target.value)}><option value="">Select an eligible agent</option>{availableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName} — {agent.email}</option>)}</select></div><Button className="w-full sm:w-auto" disabled={updating || !selectedAgentId} onClick={onAdd}>{updating ? 'Updating members…' : 'Add to team'}</Button></div>{availableAgents.length === 0 && <p className="mt-2 text-sm text-slate-600">No other active agents are available to add.</p>}</section><section className="mt-5 border-t border-slate-200 pt-5" aria-labelledby="current-members-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 id="current-members-title" className="text-sm font-semibold text-slate-900">Current members</h3><span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{members.length} {members.length === 1 ? 'member' : 'members'}</span></div>{members.length === 0 ? <p className="mt-2 text-sm text-slate-600">This team has no members yet.</p> : <ul className="mt-3 overflow-hidden rounded-md border border-slate-200 divide-y divide-slate-200">{members.map(member => <li key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold text-slate-950">{member.displayName}</p><p className="mt-1 break-all text-sm text-slate-600">{member.email}</p></div><div className="flex flex-wrap items-center gap-2"><AccountStatusBadge active={member.active} /><Button className="w-full sm:w-auto" variant="quiet" disabled={updating} onClick={() => onRemove(member)}>Remove {member.displayName}</Button></div></li>)}</ul>}</section>{error && <section className="mt-4" aria-label="Membership action feedback"><p className="rd-meta-label">Membership action needs attention</p><div className="mt-1"><Alert tone="danger">{error}</Alert></div></section>}</>}</Panel>
}

function DeactivationConfirmation({ cancelRef, onCancel, onConfirm, team, updating }: { cancelRef: RefObject<HTMLButtonElement | null>; onCancel: () => void; onConfirm: () => void; team: TicketTeamSummary; updating: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-team-title" aria-describedby="deactivate-team-description" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg sm:p-6"><p className="rd-meta-label">Routing availability</p><h2 id="deactivate-team-title" className="mt-1 text-lg font-semibold text-slate-950">Deactivate {team.name}?</h2><p id="deactivate-team-description" className="mt-2 text-sm leading-6 text-slate-600">This team will no longer be available for ticket routing. Reassign or clear all non-closed tickets before deactivating it.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button ref={cancelRef} variant="secondary" disabled={updating} onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={updating} onClick={onConfirm}>{updating ? 'Deactivating…' : 'Deactivate team'}</Button></div></section></div>
}
