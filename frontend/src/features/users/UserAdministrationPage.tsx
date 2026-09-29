import { type FormEvent, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { changeUserActive, changeUserRole, listUsers, type ManagedUser, type ManagedUserRole, type UserListQuery, type UserMutation } from '../../api/users'
import type { PageResponse } from '../../api/tickets'

const emptyFilters = { role: '', active: '', search: '', sort: 'createdAt,desc' }

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
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)

  useEffect(() => {
    setResult(null)
    setError(null)
    void listUsers(query)
      .then(setResult)
      .catch(requestError => setError(requestError instanceof ApiError ? requestError.message : 'Unable to load users.'))
  }, [query])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery({
      role: filters.role as ManagedUserRole || undefined,
      active: filters.active === '' ? undefined : filters.active === 'true',
      search: filters.search.trim() || undefined,
      sort: filters.sort,
      page: 0
    })
  }

  function applyMutation(mutation: UserMutation) {
    setResult(current => current && {
      ...current,
      content: current.content.map(user => user.id === mutation.id ? { ...user, ...mutation } : user)
    })
  }

  async function updateRole(user: ManagedUser) {
    const role = roleChanges[user.id] ?? user.role
    if (role === user.role) return
    setUpdatingUserId(user.id)
    setError(null)
    try {
      applyMutation(await changeUserRole(user.id, role))
      setRoleChanges(current => {
        const { [user.id]: removed, ...remaining } = current
        return remaining
      })
    } catch (requestError) {
      setError(userMessage(requestError))
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function updateActive(user: ManagedUser) {
    setUpdatingUserId(user.id)
    setError(null)
    try {
      applyMutation(await changeUserActive(user.id, !user.active))
    } catch (requestError) {
      setError(userMessage(requestError))
    } finally {
      setUpdatingUserId(null)
    }
  }

  function changePage(page: number) {
    setQuery(current => ({ ...current, page }))
  }

  return (
    <section aria-labelledby="user-administration-title" className="space-y-6">
      <div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">Administration</p><h1 id="user-administration-title" className="mt-2 text-3xl font-bold">User administration</h1></div>
      <form className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <label className="text-sm font-medium" htmlFor="user-role-filter">Role<select id="user-role-filter" className="mt-1 block w-full rounded border p-2" value={filters.role} onChange={event => setFilters(current => ({ ...current, role: event.target.value }))}><option value="">All roles</option><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></select></label>
        <label className="text-sm font-medium" htmlFor="user-active-filter">Account status<select id="user-active-filter" className="mt-1 block w-full rounded border p-2" value={filters.active} onChange={event => setFilters(current => ({ ...current, active: event.target.value }))}><option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <label className="text-sm font-medium sm:col-span-2" htmlFor="user-search">Search<input id="user-search" className="mt-1 block w-full rounded border p-2" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Name or email" /></label>
        <label className="text-sm font-medium" htmlFor="user-sort">Sort<select id="user-sort" className="mt-1 block w-full rounded border p-2" value={filters.sort} onChange={event => setFilters(current => ({ ...current, sort: event.target.value }))}><option value="createdAt,desc">Created, newest first</option><option value="createdAt,asc">Created, oldest first</option><option value="firstName,asc">First name</option><option value="lastName,asc">Last name</option><option value="email,asc">Email</option></select></label>
        <div className="flex items-end"><button className="rounded bg-sky-700 px-4 py-2 font-medium text-white" type="submit">Apply filters</button></div>
      </form>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {result === null && !error && <p role="status">Loading users…</p>}
      {result && (result.content.length === 0 ? <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-slate-600">No users match the current filters.</p> : <div className="overflow-x-auto rounded border border-slate-200 bg-white"><table className="min-w-full text-left"><thead className="bg-slate-100 text-sm"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead><tbody>{result.content.map(user => <tr key={user.id} className="border-t"><td className="p-3">{user.firstName} {user.lastName}</td><td className="p-3">{user.email}</td><td className="p-3"><select aria-label={`Role for ${user.email}`} className="rounded border p-1" value={roleChanges[user.id] ?? user.role} disabled={updatingUserId === user.id} onChange={event => setRoleChanges(current => ({ ...current, [user.id]: event.target.value as ManagedUserRole }))}><option value="CUSTOMER">Customer</option><option value="AGENT">Agent</option><option value="ADMIN">Administrator</option></select></td><td className="p-3">{user.active ? 'Active' : 'Inactive'}</td><td className="p-3 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button className="rounded border px-2 py-1 text-sm disabled:opacity-50" type="button" disabled={updatingUserId === user.id || (roleChanges[user.id] ?? user.role) === user.role} onClick={() => void updateRole(user)}>Update role</button><button className="rounded border px-2 py-1 text-sm disabled:opacity-50" type="button" disabled={updatingUserId === user.id} onClick={() => void updateActive(user)}>{user.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>)}
      {result && result.totalPages > 1 && <nav aria-label="User pagination" className="flex items-center gap-3"><button className="rounded border px-3 py-1 disabled:opacity-50" type="button" disabled={result.first} onClick={() => changePage(result.page - 1)}>Previous</button><span>Page {result.page + 1} of {result.totalPages}</span><button className="rounded border px-3 py-1 disabled:opacity-50" type="button" disabled={result.last} onClick={() => changePage(result.page + 1)}>Next</button></nav>}
    </section>
  )
}
