import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function IdentityHome() {
  const { user } = useAuth()
  return <section aria-labelledby="welcome-title" className="space-y-3"><p className="text-sm font-medium uppercase tracking-wide text-sky-700">Signed in</p><h1 id="welcome-title" className="text-3xl font-bold">Welcome, {user?.firstName}.</h1><p className="text-slate-600">Your ResolveDesk session is active.</p>{user?.role === 'CUSTOMER' && <Link className="inline-block text-sky-700 underline" to="/tickets/new">Create a ticket</Link>}</section>
}
