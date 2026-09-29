import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { AppSidebar, MobileNavigation } from './Navigation'

export function AppShell() {
  const { status, user, logout } = useAuth()
  const handleLogout = () => void logout()

  if (status !== 'authenticated' || !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <a className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0" href="#main-content">Skip to content</a>
        <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-7xl items-center px-4 sm:px-6"><Link className="text-lg font-bold tracking-tight text-slate-950 focus-visible:rounded-md" to="/">ResolveDesk</Link></div></header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"><Outlet /></main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a className="absolute left-4 top-4 z-50 -translate-y-20 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0" href="#main-content">Skip to content</a>
      <AppSidebar user={user} onLogout={handleLogout} />
      <div className="min-h-screen lg:pl-60"><MobileNavigation user={user} onLogout={handleLogout} /><main id="main-content" tabIndex={-1} className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12"><Outlet /></main></div>
    </div>
  )
}
