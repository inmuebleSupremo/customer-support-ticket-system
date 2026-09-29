import { apiRequest } from './client'
import type { PageResponse } from './tickets'

export type ManagedUserRole = 'CUSTOMER' | 'AGENT' | 'ADMIN'

export interface ManagedUser {
  id: number
  firstName: string
  lastName: string
  email: string
  role: ManagedUserRole
  active: boolean
  createdAt: string
}

export interface UserMutation {
  id: number
  firstName: string
  lastName: string
  email: string
  role: ManagedUserRole
  active: boolean
}

export interface UserListQuery {
  role?: ManagedUserRole
  active?: boolean
  search?: string
  page?: number
  size?: number
  sort?: string
}

export function listUsers(query: UserListQuery = {}): Promise<PageResponse<ManagedUser>> {
  const params = new URLSearchParams()
  if (query.role) params.set('role', query.role)
  if (query.active !== undefined) params.set('active', String(query.active))
  if (query.search) params.set('search', query.search)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.size !== undefined) params.set('size', String(query.size))
  if (query.sort) params.set('sort', query.sort)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiRequest(`/users${suffix}`)
}

export function changeUserRole(id: number, role: ManagedUserRole): Promise<UserMutation> {
  return apiRequest(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, true)
}

export function changeUserActive(id: number, active: boolean): Promise<UserMutation> {
  return apiRequest(`/users/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }, true)
}
