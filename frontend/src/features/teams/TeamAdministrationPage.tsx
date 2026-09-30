import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { createTeam, getTeams, type TicketTeamSummary } from '../../api/tickets'
import { AccountStatusBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'

export function TeamAdministrationPage() {
  const [teams, setTeams] = useState<TicketTeamSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      setTeams(await getTeams(true))
      setLoadError(null)
    } catch (requestError) {
      setLoadError(requestError instanceof ApiError ? requestError.message : 'Unable to load teams.')
    }
  }, [])

  useEffect(() => { void loadTeams() }, [loadTeams])

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

  return <section aria-labelledby="team-administration-title" className="space-y-6"><PageHeader id="team-administration-title" eyebrow="Administration" title="Team administration">Review ResolveDesk support teams and their operating status.{teams && <span className="ml-1 font-medium text-slate-700">{teams.length} {teams.length === 1 ? 'team' : 'teams'}.</span>}</PageHeader><Panel><form className="flex flex-wrap items-end gap-3" noValidate onSubmit={create} aria-busy={creating}><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="team-name">Team name</label><input id="team-name" className="rd-input" value={name} onChange={event => { setName(event.target.value); setNameError(null); setCreateError(null) }} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'team-name-error' : undefined} />{nameError && <p id="team-name-error" className="rd-validation-message">{nameError}</p>}</div><Button type="submit" disabled={creating} aria-busy={creating}>{creating ? 'Creating team…' : 'Create team'}</Button></form>{createError && <div className="mt-4"><Alert tone="danger">{createError}</Alert></div>}</Panel>{loadError && <Alert tone="danger">{loadError}</Alert>}{teams === null && !loadError && <LoadingState label="Loading teams…" />}{teams && (teams.length === 0 ? <EmptyState title="No teams yet">Support teams will appear here when they are created.</EmptyState> : <TeamResults teams={teams} />)}</section>
}

function TeamResults({ teams }: { teams: TicketTeamSummary[] }) {
  return <Panel className="overflow-hidden p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Team</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200">{teams.map(team => <tr key={team.id} className="transition-colors hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-950">{team.name}</td><td className="px-5 py-4"><AccountStatusBadge active={team.active} /></td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{teams.map(team => <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><p className="font-semibold text-slate-950">{team.name}</p><AccountStatusBadge active={team.active} /></li>)}</ul></Panel>
}
