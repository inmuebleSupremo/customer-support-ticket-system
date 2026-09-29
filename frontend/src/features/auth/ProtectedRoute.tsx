import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../../api/auth'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p role="status">Restoring your session…</p>
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) return <section aria-labelledby="access-denied-title"><h1 id="access-denied-title" className="text-3xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">You do not have access to this area.</p></section>
  return <Outlet />
}
