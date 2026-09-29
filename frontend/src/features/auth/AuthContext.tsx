import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, fetchCsrfToken } from '../../api/client'
import * as authApi from '../../api/auth'
import type { CurrentUser, LoginInput, RegistrationInput } from '../../api/auth'

type AuthenticationStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthenticationStatus
  user: CurrentUser | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegistrationInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthenticationStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    async function restoreSession() {
      try {
        await fetchCsrfToken()
        setUser(await authApi.currentUser())
        setStatus('authenticated')
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error('Unable to restore the ResolveDesk session.', error)
        }
        setUser(null)
        setStatus('anonymous')
      }
    }
    void restoreSession()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    async login(input) {
      setUser(await authApi.login(input))
      setStatus('authenticated')
    },
    async register(input) { await authApi.register(input) },
    async logout() {
      await authApi.logout()
      setUser(null)
      setStatus('anonymous')
    }
  }), [status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider.')
  return context
}
