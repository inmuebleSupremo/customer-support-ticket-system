import { apiRequest } from './client'

export type UserRole = 'CUSTOMER' | 'AGENT' | 'ADMIN'

export interface CurrentUser {
  id: number
  firstName: string
  lastName: string
  email: string
  role: UserRole
  active: boolean
  createdAt?: string
}

export interface RegistrationInput { firstName: string; lastName: string; email: string; password: string }
export interface LoginInput { email: string; password: string }

export function register(input: RegistrationInput): Promise<CurrentUser> {
  return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(input) }, true)
}

export async function login(input: LoginInput): Promise<CurrentUser> {
  const response = await apiRequest<{ user: CurrentUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify(input)
  }, true)
  return response.user
}

export function currentUser(): Promise<CurrentUser> { return apiRequest('/users/me') }
export function logout(): Promise<void> { return apiRequest('/auth/logout', { method: 'POST' }, true) }
