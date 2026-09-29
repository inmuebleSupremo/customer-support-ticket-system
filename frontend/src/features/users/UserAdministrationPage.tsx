import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { changeUserActive, changeUserRole, listUsers, type ManagedUser, type ManagedUserRole, type UserListQuery, type UserMutation } from '../../api/users'
import type { PageResponse } from '../../api/tickets'
import { AccountStatusBadge, RoleBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { Panel } from '../../components/ui/Panel'

const emptyFilters = { role: '', active: '', search: '', sort: 'createdAt,desc' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function userMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Unable to update the user account.'
  if (error.problem.code === 'LAST_ACTIVE_ADMIN') return 'The final active administrator cannot be demoted or deactivated.'
  if (error.problem.code === 'AGENT_HAS_ACTIVE_TICKETS') return error.problem.detail ?? 'Reassign or unassign the agent’s applicable tickets before changing this account.'
  return error.message
}

export function UserAdministrationPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [query, setQuery] = useState<UserListQuery>({ sort: 'createdAt,desc' })
  const [result, setResult] = useState<PageResponse<ManagedUser> | null>(null)
  const [roleChanges, setRoleChanges] = useState<Record<number, ManagedUserRole>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationErrors, setMutationErrors] = useState<Record<number, string>>({})
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [confirmingUser, setConfirmingUser] = useState<ManagedUser | null>(null)
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setResult(null)
    setLoadError(null)
    void listUsers(query).then(setResult).catch(requestError => setLoadError(requestError instanceof ApiError ? requestError.message : 'Unable to load users.'))
  }, [query])

  useEffect(() => {
    if (!confirmingUser) return
    cancelConfirmationRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeConfirmation() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [confirmingUser])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery({ role: filters.role as ManagedUserRole || undefined, active: filters.active === '' ? undefined : filters.active === 'true', search: filters.search.trim() || undefined, sort: filters.sort, page: 0 })
  }

  function clearFilters() {
    setFilters(emptyFilters)
    setQuery({ sort: emptyFilters.sort, page: 0 })
  }

  function openDeactivationConfirmation(user: ManagedUser) {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setConfirmingUser(user)
  }

  function closeConfirmation() {
    setConfirmingUser(null)
    window.requestAnimationFrame(() => previousFocusRef.current?.focus())
  }

  function applyMutation(mutation: UserMutation) {
    setResult(current => current && { ...current, content: current.content.map(user => user.id === mutation.id ? { ...user, ...mutation } : user) })
  }

  async function updateRole(user: ManagedUser) {
    const role = roleChanges[user.id] ?? user.role
    if (role === user.role) return
    setUpdatingUserId(user.id)
    setMutationErrors(current => { const { [user.id]: removed, ...remaining } = current; return remaining })
    try {
      applyMutation(await changeUserRole(user.id, role))
      setRoleChanges(current => { const { [user.id]: removed, ...remaining } = current; return remaining })
    } catch (requestError) {
      setMutationErrors(current => ({ ...current, [user.id]: userMessage(requestError) }))
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function updateActive(user: ManagedUser) {
    setUpdatingUserId(user.id)
    setMutationErrors(current => { const { [user.id]: removed, ...remaining } = current; return remaining })
    try {
      applyMutation(await changeUserActive(user.id, !user.active))
    } catch (requestError) {
      setMutationErrors(current => ({ ...current, [user.id]: userMessage(requestError) }))
    } finally {
      setUpdatingUserId(null)
      if (user.active) closeConfirmation()
    }
  }

  const hasActiveFilters = filters.role !== '' || filters.active !== '' || filters.search.trim() !== '' || filters.sort !== emptyFilters.sort

  return <section aria-labelledby="user-administration-title" className="space-y-6"><PageHeader id="user-administration-title" eyebrow="Administration" title="User administration">Manage access and responsibilities across ResolveDesk.{result && <span className="ml-1 font-medium text-slate-700">{result.totalElements} {result.totalElements === 1 ? 'user' : 'users'}.</span>}</PageHeader><Panel><form className="space-y-4" onSubmit={applyFilters} aria-busy={result === null && !loadError}><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="user-search">Search users</label><input id="user-search" className="rd-input" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Name or email" /></div><div className="flex gap-2"><Button variant="secondary" type="button" disabled={!hasActiveFilters} onClick={clearFilters}>Clear filters</Button><Button type="submit">Apply filters</Button></div></div><div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 xl:grid-cols-3"><FilterSelect id="user-role-filter" label="Role" value={filters.role} onChange={value => setFilters(current => ({ ...current, role: value }))}><option value="">All roles</option><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></FilterSelect><FilterSelect id="user-active-filter" label="Account status" value={filters.active} onChange={value => setFilters(current => ({ ...current, active: value }))}><option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option></FilterSelect><FilterSelect id="user-sort" label="Sort" value={filters.sort} onChange={value => setFilters(current => ({ ...current, sort: value }))}><option value="createdAt,desc">Created, newest first</option><option value="createdAt,asc">Created, oldest first</option><option value="firstName,asc">First name</option><option value="lastName,asc">Last name</option><option value="email,asc">Email</option></FilterSelect></div></form></Panel>{loadError && <Alert tone="danger">{loadError}</Alert>}{result === null && !loadError && <LoadingState label="Loading users…" />}{result && (result.content.length === 0 ? <EmptyState title="No matching users">No users match the current filters.</EmptyState> : <UserResults users={result.content} roleChanges={roleChanges} mutationErrors={mutationErrors} updatingUserId={updatingUserId} onRoleChange={(id, role) => setRoleChanges(current => ({ ...current, [id]: role }))} onRoleUpdate={updateRole} onActiveUpdate={user => user.active ? openDeactivationConfirmation(user) : void updateActive(user)} />)}{result && <Pagination first={result.first} last={result.last} page={result.page} totalPages={result.totalPages} onPageChange={page => setQuery(current => ({ ...current, page }))} />}{confirmingUser && <DeactivationConfirmation user={confirmingUser} cancelRef={cancelConfirmationRef} onCancel={closeConfirmation} onConfirm={() => void updateActive(confirmingUser)} updating={updatingUserId === confirmingUser.id} />}</section>
}

function FilterSelect({ children, id, label, onChange, value }: { children: React.ReactNode; id: string; label: string; onChange: (value: string) => void; value: string }) {
  return <div><label className="rd-label" htmlFor={id}>{label}</label><select id={id} className="rd-select" value={value} onChange={event => onChange(event.target.value)}>{children}</select></div>
}

function UserResults({ mutationErrors, onActiveUpdate, onRoleChange, onRoleUpdate, roleChanges, updatingUserId, users }: { mutationErrors: Record<number, string>; onActiveUpdate: (user: ManagedUser) => void; onRoleChange: (id: number, role: ManagedUserRole) => void; onRoleUpdate: (user: ManagedUser) => void; roleChanges: Record<number, ManagedUserRole>; updatingUserId: number | null; users: ManagedUser[] }) {
  const actions = (user: ManagedUser) => <UserActions user={user} nextRole={roleChanges[user.id] ?? user.role} updating={updatingUserId === user.id} error={mutationErrors[user.id]} onRoleChange={role => onRoleChange(user.id, role)} onRoleUpdate={() => onRoleUpdate(user)} onActiveUpdate={() => onActiveUpdate(user)} />
  return <Panel className="overflow-hidden p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Account</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{users.map(user => <tr key={user.id} className="align-top transition-colors hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">{user.firstName} {user.lastName}</td><td className="px-5 py-4 text-sm text-slate-600">{user.email}</td><td className="px-5 py-4"><RoleBadge role={user.role} /></td><td className="px-5 py-4"><AccountStatusBadge active={user.active} /></td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{formatDate(user.createdAt)}</td><td className="min-w-80 px-5 py-4">{actions(user)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{users.map(user => <li key={user.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{user.firstName} {user.lastName}</p><p className="mt-1 break-all text-sm text-slate-600">{user.email}</p></div><div className="flex flex-wrap gap-2"><RoleBadge role={user.role} /><AccountStatusBadge active={user.active} /></div></div><p className="mt-3 text-xs text-slate-500">Created {formatDate(user.createdAt)}</p>{actions(user)}</li>)}</ul></Panel>
}

function UserActions({ error, nextRole, onActiveUpdate, onRoleChange, onRoleUpdate, updating, user }: { error?: string; nextRole: ManagedUserRole; onActiveUpdate: () => void; onRoleChange: (role: ManagedUserRole) => void; onRoleUpdate: () => void; updating: boolean; user: ManagedUser }) {
  return <div className="mt-4 space-y-3 lg:mt-0"><div className="flex flex-wrap items-end gap-2"><div className="min-w-40 flex-1"><label className="rd-label" htmlFor={`user-role-${user.id}`}>Role for {user.email}</label><select id={`user-role-${user.id}`} className="rd-select" value={nextRole} disabled={updating} onChange={event => onRoleChange(event.target.value as ManagedUserRole)}><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></select></div><Button variant="secondary" disabled={updating || nextRole === user.role} onClick={onRoleUpdate}>Update role</Button></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"><p className="text-xs text-slate-500">{user.active ? 'Access is currently enabled.' : 'Access is currently disabled.'}</p><Button variant={user.active ? 'danger' : 'secondary'} disabled={updating} onClick={onActiveUpdate}>{user.active ? 'Deactivate' : 'Activate'}</Button></div>{error && <Alert tone="danger">{error}</Alert>}</div>
}

function DeactivationConfirmation({ cancelRef, onCancel, onConfirm, updating, user }: { cancelRef: React.RefObject<HTMLButtonElement | null>; onCancel: () => void; onConfirm: () => void; updating: boolean; user: ManagedUser }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-user-title" aria-describedby="deactivate-user-description" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg sm:p-6"><h2 id="deactivate-user-title" className="text-lg font-semibold text-slate-950">Deactivate {user.firstName} {user.lastName}?</h2><p id="deactivate-user-description" className="mt-2 text-sm leading-6 text-slate-600">This disables their ResolveDesk access. Existing server safeguards, including final-administrator protection, still apply.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button ref={cancelRef} variant="secondary" disabled={updating} onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={updating} onClick={onConfirm}>{updating ? 'Deactivating…' : 'Deactivate account'}</Button></div></section></div>
}
