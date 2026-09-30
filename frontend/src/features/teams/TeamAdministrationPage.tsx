import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { getTeams, type TicketTeamSummary } from '../../api/tickets'
import { AccountStatusBadge } from '../../components/ui/Badges'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'

export function TeamAdministrationPage() {
  const [teams, setTeams] = useState<TicketTeamSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getTeams(true).then(setTeams).catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load teams.'))
  }, [])

  return <section aria-labelledby="team-administration-title" className="space-y-6"><PageHeader id="team-administration-title" eyebrow="Administration" title="Team administration">Review ResolveDesk support teams and their operating status.{teams && <span className="ml-1 font-medium text-slate-700">{teams.length} {teams.length === 1 ? 'team' : 'teams'}.</span>}</PageHeader>{error && <Alert tone="danger">{error}</Alert>}{teams === null && !error && <LoadingState label="Loading teams…" />}{teams && (teams.length === 0 ? <EmptyState title="No teams yet">Support teams will appear here when they are created.</EmptyState> : <TeamResults teams={teams} />)}</section>
}

function TeamResults({ teams }: { teams: TicketTeamSummary[] }) {
  return <Panel className="overflow-hidden p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Team</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200">{teams.map(team => <tr key={team.id} className="transition-colors hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-950">{team.name}</td><td className="px-5 py-4"><AccountStatusBadge active={team.active} /></td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{teams.map(team => <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><p className="font-semibold text-slate-950">{team.name}</p><AccountStatusBadge active={team.active} /></li>)}</ul></Panel>
}
