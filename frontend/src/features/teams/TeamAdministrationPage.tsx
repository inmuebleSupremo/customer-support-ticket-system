import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
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

  return <section aria-labelledby="team-administration-title" className="space-y-6"><PageHeader id="team-administration-title" eyebrow="Administration" title="Team administration">Review ResolveDesk support teams and their operating status.{teams && <span className="ml-1 font-medium text-slate-700">{teams.length} {teams.length === 1 ? 'team' : 'teams'}.</span>}</PageHeader><Panel><form className="flex flex-wrap items-end gap-3" noValidate onSubmit={create} aria-busy={creating}><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="team-name">Team name</label><input id="team-name" className="rd-input" value={name} onChange={event => { setName(event.target.value); setNameError(null); setCreateError(null) }} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'team-name-error' : undefined} />{nameError && <p id="team-name-error" className="rd-validation-message">{nameError}</p>}</div><Button type="submit" disabled={creating} aria-busy={creating}>{creating ? 'Creating team…' : 'Create team'}</Button></form>{createError && <div className="mt-4"><Alert tone="danger">{createError}</Alert></div>}</Panel>{teamBeingRenamed && <Panel><form className="flex flex-wrap items-end gap-3" noValidate onSubmit={rename} aria-busy={renaming}><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="rename-team-name">Rename {teamBeingRenamed.name}</label><input id="rename-team-name" className="rd-input" value={renameName} onChange={event => { setRenameName(event.target.value); setRenameNameError(null); setRenameError(null) }} maxLength={120} aria-invalid={Boolean(renameNameError)} aria-describedby={renameNameError ? 'rename-team-name-error' : undefined} />{renameNameError && <p id="rename-team-name-error" className="rd-validation-message">{renameNameError}</p>}</div><div className="flex gap-2"><Button type="button" variant="secondary" disabled={renaming} onClick={() => setTeamBeingRenamed(null)}>Cancel</Button><Button type="submit" disabled={renaming} aria-busy={renaming}>{renaming ? 'Renaming team…' : 'Rename team'}</Button></div></form>{renameError && <div className="mt-4"><Alert tone="danger">{renameError}</Alert></div>}</Panel>}{teamBeingManaged && <MembershipPanel agents={eligibleAgents} error={membershipError} loadError={membershipLoadError} onAdd={() => void addMember()} onClose={() => setTeamBeingManaged(null)} onRemove={member => void removeMember(member)} onSelectedAgentChange={setSelectedAgentId} selectedAgentId={selectedAgentId} team={teamDetail ?? teamBeingManaged} updating={updatingMembership} />}{loadError && <Alert tone="danger">{loadError}</Alert>}{teams === null && !loadError && <LoadingState label="Loading teams…" />}{teams && (teams.length === 0 ? <EmptyState title="No teams yet">Support teams will appear here when they are created.</EmptyState> : <TeamResults teams={teams} mutationErrors={statusErrors} onActiveUpdate={team => team.active ? openDeactivationConfirmation(team) : void updateActive(team)} onManageMembers={beginMembershipManagement} onRename={beginRename} updatingTeamId={updatingTeamId} />)}{teamBeingDeactivated && <DeactivationConfirmation cancelRef={cancelDeactivationRef} onCancel={closeDeactivationConfirmation} onConfirm={() => void updateActive(teamBeingDeactivated)} team={teamBeingDeactivated} updating={updatingTeamId === teamBeingDeactivated.id} />}</section>
}

function TeamResults({ mutationErrors, onActiveUpdate, onManageMembers, onRename, teams, updatingTeamId }: { mutationErrors: Record<number, string>; onActiveUpdate: (team: TicketTeamSummary) => void; onManageMembers: (team: TicketTeamSummary) => void; onRename: (team: TicketTeamSummary) => void; teams: TicketTeamSummary[]; updatingTeamId: number | null }) {
  const actions = (team: TicketTeamSummary) => <TeamActions error={mutationErrors[team.id]} onActiveUpdate={() => onActiveUpdate(team)} onManageMembers={() => onManageMembers(team)} onRename={() => onRename(team)} team={team} updating={updatingTeamId === team.id} />
  return <Panel className="overflow-hidden p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Team</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{teams.map(team => <tr key={team.id} className="align-top transition-colors hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-950">{team.name}</td><td className="px-5 py-4"><AccountStatusBadge active={team.active} /></td><td className="min-w-72 px-5 py-4">{actions(team)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{teams.map(team => <li key={team.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><p className="font-semibold text-slate-950">{team.name}</p><AccountStatusBadge active={team.active} /></div>{actions(team)}</li>)}</ul></Panel>
}

function TeamActions({ error, onActiveUpdate, onManageMembers, onRename, team, updating }: { error?: string; onActiveUpdate: () => void; onManageMembers: () => void; onRename: () => void; team: TicketTeamSummary; updating: boolean }) {
  return <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" disabled={updating} onClick={onRename}>Rename {team.name}</Button><Button variant="secondary" disabled={updating} onClick={onManageMembers}>Manage members {team.name}</Button><Button variant={team.active ? 'danger' : 'secondary'} disabled={updating} onClick={onActiveUpdate}>{team.active ? `Deactivate ${team.name}` : `Reactivate ${team.name}`}</Button>{error && <div className="w-full"><Alert tone="danger">{error}</Alert></div>}</div>
}

function MembershipPanel({ agents, error, loadError, onAdd, onClose, onRemove, onSelectedAgentChange, selectedAgentId, team, updating }: { agents: AgentSummary[] | null; error: string | null; loadError: string | null; onAdd: () => void; onClose: () => void; onRemove: (member: TeamMember) => void; onSelectedAgentChange: (id: string) => void; selectedAgentId: string; team: TicketTeamSummary | TeamAdministrationDetail; updating: boolean }) {
  const members = 'members' in team ? team.members : null
  const availableAgents = agents?.filter(agent => !members?.some(member => member.id === agent.id)) ?? []
  return <Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">Members of {team.name}</h2><p className="mt-1 text-sm text-slate-600">Add active agents to this team or remove existing memberships.</p></div><Button type="button" variant="secondary" disabled={updating} onClick={onClose}>Close members</Button></div>{loadError && <div className="mt-4"><Alert tone="danger">{loadError}</Alert></div>}{members === null && !loadError && <div className="mt-5"><LoadingState label="Loading team members…" /></div>}{members && <><div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-5"><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="team-member-agent">Add an agent to {team.name}</label><select id="team-member-agent" className="rd-select" value={selectedAgentId} disabled={updating} onChange={event => onSelectedAgentChange(event.target.value)}><option value="">Select an eligible agent</option>{availableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName} — {agent.email}</option>)}</select></div><Button disabled={updating || !selectedAgentId} onClick={onAdd}>{updating ? 'Updating members…' : 'Add to team'}</Button></div>{availableAgents.length === 0 && <p className="mt-2 text-sm text-slate-600">No other active agents are available to add.</p>}<div className="mt-5 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-950">Current members</h3>{members.length === 0 ? <p className="mt-2 text-sm text-slate-600">This team has no members yet.</p> : <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div><p className="font-semibold text-slate-950">{member.displayName}</p><p className="mt-1 text-sm text-slate-600">{member.email}</p></div><div className="flex flex-wrap items-center gap-3"><AccountStatusBadge active={member.active} /><Button variant="danger" disabled={updating} onClick={() => onRemove(member)}>Remove {member.displayName}</Button></div></li>)}</ul>}</div>{error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}</>}</Panel>
}

function DeactivationConfirmation({ cancelRef, onCancel, onConfirm, team, updating }: { cancelRef: React.RefObject<HTMLButtonElement | null>; onCancel: () => void; onConfirm: () => void; team: TicketTeamSummary; updating: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-team-title" aria-describedby="deactivate-team-description" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg sm:p-6"><h2 id="deactivate-team-title" className="text-lg font-semibold text-slate-950">Deactivate {team.name}?</h2><p id="deactivate-team-description" className="mt-2 text-sm leading-6 text-slate-600">This team will no longer be available for ticket routing. Reassign or clear all non-closed tickets before deactivating it.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button ref={cancelRef} variant="secondary" disabled={updating} onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={updating} onClick={onConfirm}>{updating ? 'Deactivating…' : 'Deactivate team'}</Button></div></section></div>
}
