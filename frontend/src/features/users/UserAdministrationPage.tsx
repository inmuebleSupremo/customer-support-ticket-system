import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { changeUserActive, changeUserRole, listUsers, type ManagedUser, type ManagedUserRole, type UserListQuery, type UserMutation } from '../../api/users'
import type { PageResponse } from '../../api/tickets'
import { AccountStatusBadge, RoleBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { Panel } from '../../components/ui/Panel'
import { trapFocusWithin, useScrollLock } from '../../components/ui/overlay'

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

function roleDescription(role: ManagedUserRole) {
  return role === 'CUSTOMER' ? 'Can create and follow their own tickets.' : role === 'AGENT' ? 'Can work the support queue and ticket workflow.' : 'Can manage users and operational settings.'
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
  const confirmationDialogRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useScrollLock(confirmingUser !== null)

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

  return <section aria-labelledby="user-administration-title" className="space-y-6">
    <PageHeader id="user-administration-title" eyebrow="Operations administration" title="User administration" meta={result ? `${result.totalElements} ${result.totalElements === 1 ? 'user' : 'users'}` : undefined}>Manage account access and operational responsibilities across ResolveDesk.</PageHeader>
    <Panel className="border-slate-300 p-4 sm:p-5"><form className="space-y-5" onSubmit={applyFilters} aria-busy={result === null && !loadError}><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-[16rem] flex-1"><label className="rd-label" htmlFor="user-search">Search users</label><input id="user-search" className="rd-input" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Name or email" /></div><div className="flex flex-wrap gap-2"><Button variant="secondary" type="button" disabled={!hasActiveFilters} onClick={clearFilters}>Clear filters</Button><Button type="submit">Apply filters</Button></div></div><fieldset className="border-t border-slate-200 pt-4"><legend className="rd-meta-label px-0">Refine people</legend><div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><FilterSelect id="user-role-filter" label="Role" value={filters.role} onChange={value => setFilters(current => ({ ...current, role: value }))}><option value="">All roles</option><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></FilterSelect><FilterSelect id="user-active-filter" label="Account status" value={filters.active} onChange={value => setFilters(current => ({ ...current, active: value }))}><option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option></FilterSelect><FilterSelect id="user-sort" label="Sort" value={filters.sort} onChange={value => setFilters(current => ({ ...current, sort: value }))}><option value="createdAt,desc">Created, newest first</option><option value="createdAt,asc">Created, oldest first</option><option value="firstName,asc">First name</option><option value="lastName,asc">Last name</option><option value="email,asc">Email</option></FilterSelect></div></fieldset></form></Panel>
    {loadError && <Alert tone="danger">{loadError}</Alert>}
    {result === null && !loadError && <LoadingState label="Loading users…" />}
    {result && (result.content.length === 0 ? <EmptyState title="No matching users">No users match the current filters.</EmptyState> : <UserResults users={result.content} roleChanges={roleChanges} mutationErrors={mutationErrors} updatingUserId={updatingUserId} onRoleChange={(id, role) => setRoleChanges(current => ({ ...current, [id]: role }))} onRoleUpdate={updateRole} onActiveUpdate={user => user.active ? openDeactivationConfirmation(user) : void updateActive(user)} />)}
    {result && <Pagination first={result.first} last={result.last} page={result.page} totalPages={result.totalPages} onPageChange={page => setQuery(current => ({ ...current, page }))} />}
    {confirmingUser && <DeactivationConfirmation user={confirmingUser} cancelRef={cancelConfirmationRef} dialogRef={confirmationDialogRef} onCancel={closeConfirmation} onConfirm={() => void updateActive(confirmingUser)} updating={updatingUserId === confirmingUser.id} />}
  </section>
}

function FilterSelect({ children, id, label, onChange, value }: { children: ReactNode; id: string; label: string; onChange: (value: string) => void; value: string }) {
  return <div><label className="rd-label" htmlFor={id}>{label}</label><select id={id} className="rd-select" value={value} onChange={event => onChange(event.target.value)}>{children}</select></div>
}

function UserResults({ mutationErrors, onActiveUpdate, onRoleChange, onRoleUpdate, roleChanges, updatingUserId, users }: { mutationErrors: Record<number, string>; onActiveUpdate: (user: ManagedUser) => void; onRoleChange: (id: number, role: ManagedUserRole) => void; onRoleUpdate: (user: ManagedUser) => void; roleChanges: Record<number, ManagedUserRole>; updatingUserId: number | null; users: ManagedUser[] }) {
  const actions = (user: ManagedUser) => <UserActions user={user} nextRole={roleChanges[user.id] ?? user.role} updating={updatingUserId === user.id} error={mutationErrors[user.id]} onRoleChange={role => onRoleChange(user.id, role)} onRoleUpdate={() => onRoleUpdate(user)} onActiveUpdate={() => onActiveUpdate(user)} />
  return <Panel className="overflow-hidden border-slate-300 p-0"><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="border-b border-slate-200 bg-slate-50 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><tr><th scope="col" className="px-5 py-3">User</th><th scope="col" className="px-5 py-3">Role</th><th scope="col" className="px-5 py-3">Account access</th><th scope="col" className="px-5 py-3">Created</th><th scope="col" className="px-5 py-3">Administration</th></tr></thead><tbody className="divide-y divide-slate-200">{users.map(user => <tr key={user.id} className="align-top transition-colors hover:bg-slate-50"><td className="min-w-[18rem] px-5 py-4"><p className="font-semibold text-slate-950">{user.firstName} {user.lastName}</p><p className="mt-1 break-all text-sm text-slate-600">{user.email}</p><p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">User #{user.id}</p></td><td className="min-w-[13rem] px-5 py-4"><RoleBadge role={user.role} /><p className="mt-2 text-sm leading-5 text-slate-600">{roleDescription(user.role)}</p></td><td className="min-w-[13rem] px-5 py-4"><AccountStatusBadge active={user.active} /><p className="mt-2 text-sm leading-5 text-slate-600">{user.active ? 'Can sign in and use their permitted workspace.' : 'Cannot sign in while access is inactive.'}</p></td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{formatDate(user.createdAt)}</td><td className="min-w-[24rem] px-5 py-4">{actions(user)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-200 lg:hidden">{users.map(user => <li key={user.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-950">{user.firstName} {user.lastName}</p><p className="mt-1 break-all text-sm text-slate-600">{user.email}</p><p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">User #{user.id}</p></div><div className="shrink-0"><AccountStatusBadge active={user.active} /></div></div><div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200"><div className="bg-white px-3 py-3"><p className="rd-meta-label">Role</p><div className="mt-1"><RoleBadge role={user.role} /></div></div><div className="bg-white px-3 py-3"><p className="rd-meta-label">Account</p><p className="mt-1 text-sm font-medium text-slate-800">{user.active ? 'Access enabled' : 'Access inactive'}</p></div></div><p className="mt-3 text-xs text-slate-500">Created {formatDate(user.createdAt)}</p>{actions(user)}</li>)}</ul></Panel>
}

function UserActions({ error, nextRole, onActiveUpdate, onRoleChange, onRoleUpdate, updating, user }: { error?: string; nextRole: ManagedUserRole; onActiveUpdate: () => void; onRoleChange: (role: ManagedUserRole) => void; onRoleUpdate: () => void; updating: boolean; user: ManagedUser }) {
  return <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 lg:mt-0"><section className="py-4 first:pt-0"><p className="rd-meta-label">Role and responsibility</p><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label className="rd-label" htmlFor={`user-role-${user.id}`}>Role for {user.email}</label><select id={`user-role-${user.id}`} className="rd-select" value={nextRole} disabled={updating} onChange={event => onRoleChange(event.target.value as ManagedUserRole)}><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></select></div><Button className="w-full sm:w-auto" variant="secondary" disabled={updating || nextRole === user.role} onClick={onRoleUpdate}>Update role</Button></div></section><section className="py-4 last:pb-0"><p className="rd-meta-label">Account access</p><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-5 text-slate-600">{user.active ? 'Access is currently enabled.' : 'Access is currently disabled.'}</p><Button className="w-full sm:w-auto" variant="quiet" disabled={updating} onClick={onActiveUpdate}>{user.active ? 'Deactivate' : 'Activate'}</Button></div></section>{error && <section className="py-4 last:pb-0" aria-label="Account action feedback"><p className="rd-meta-label">Action needs attention</p><div className="mt-1"><Alert tone="danger">{error}</Alert></div></section>}</div>
}

function DeactivationConfirmation({ cancelRef, dialogRef, onCancel, onConfirm, updating, user }: { cancelRef: RefObject<HTMLButtonElement | null>; dialogRef: RefObject<HTMLElement | null>; onCancel: () => void; onConfirm: () => void; updating: boolean; user: ManagedUser }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="deactivate-user-title" aria-describedby="deactivate-user-description" tabIndex={-1} onKeyDown={event => trapFocusWithin(event, dialogRef.current)} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg sm:p-6"><p className="rd-meta-label">Account access</p><h2 id="deactivate-user-title" className="mt-1 text-lg font-semibold text-slate-950">Deactivate {user.firstName} {user.lastName}?</h2><p id="deactivate-user-description" className="mt-2 text-sm leading-6 text-slate-600">This disables their ResolveDesk access. Existing server safeguards, including final-administrator protection, still apply.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button ref={cancelRef} variant="secondary" disabled={updating} onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={updating} onClick={onConfirm}>{updating ? 'Deactivating…' : 'Deactivate account'}</Button></div></section></div>
}
