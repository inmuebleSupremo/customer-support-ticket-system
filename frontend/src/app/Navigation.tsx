import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { CurrentUser, UserRole } from '../api/auth'
import { Button } from '../components/ui/Button'
import { RoleBadge } from '../components/ui/Badges'

interface NavigationItem {
  label: string
  to: string
  isActive: (pathname: string) => boolean
}

const homeItem: NavigationItem = { label: 'Home', to: '/', isActive: pathname => pathname === '/' }

function roleNavigation(role: UserRole): NavigationItem[] {
  if (role === 'CUSTOMER') {
    return [homeItem, { label: 'My Tickets', to: '/tickets', isActive: pathname => (pathname === '/tickets' || pathname.startsWith('/tickets/')) && pathname !== '/tickets/new' }, { label: 'Create Ticket', to: '/tickets/new', isActive: pathname => pathname === '/tickets/new' }]
  }
  if (role === 'ADMIN') {
    return [homeItem, { label: 'Support Queue', to: '/queue', isActive: pathname => pathname === '/queue' || pathname.startsWith('/tickets/') }, { label: 'User Administration', to: '/admin/users', isActive: pathname => pathname.startsWith('/admin/users') }]
  }
  return [homeItem, { label: 'Support Queue', to: '/queue', isActive: pathname => pathname === '/queue' || pathname.startsWith('/tickets/') }]
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return <Link className="inline-flex min-h-11 items-center text-lg font-bold tracking-tight text-slate-950 focus-visible:rounded-md" to="/" onClick={onNavigate}>ResolveDesk</Link>
}

function NavigationLinks({ onNavigate, role }: { onNavigate?: () => void; role: UserRole }) {
  const { pathname } = useLocation()
  return <nav aria-label="Primary navigation" className="space-y-1">{roleNavigation(role).map(item => {
    const active = item.isActive(pathname)
    return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} onClick={onNavigate} className={`group relative flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-sky-700 ${active ? 'bg-sky-50 pl-4 font-semibold text-slate-950' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><span aria-hidden="true" className={`absolute left-0 h-6 w-1 rounded-r ${active ? 'bg-sky-700' : 'bg-transparent group-hover:bg-slate-300'}`} />{item.label}</Link>
  })}</nav>
}

function UserIdentity({ user }: { user: CurrentUser }) {
  return <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{user.firstName} {user.lastName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p><div className="mt-2"><RoleBadge role={user.role} /></div></div>
}

export function AppSidebar({ onLogout, user }: { onLogout: () => void; user: CurrentUser }) {
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex"><div className="px-5 py-5"><Brand /></div><div className="flex-1 px-3 py-2"><NavigationLinks role={user.role} /></div><div className="border-t border-slate-200 p-4"><UserIdentity user={user} /><Button className="mt-4 w-full justify-start" variant="quiet" onClick={onLogout}>Log out {user.firstName}</Button></div></aside>
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled'))
}

export function MobileNavigation({ onLogout, user }: { onLogout: () => void; user: CurrentUser }) {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  function closeMenu() {
    setOpen(false)
    window.setTimeout(() => menuButtonRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!open) return
    drawerRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || !drawerRef.current) return
    const elements = focusableElements(drawerRef.current)
    if (elements.length === 0) return
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden"><div className="flex min-h-16 items-center justify-between px-4"><Brand /><button ref={menuButtonRef} type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50" aria-label="Open navigation menu" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}>Menu</button></div>{open && <><button type="button" className="fixed inset-0 z-30 cursor-default bg-slate-950/20" aria-label="Close navigation menu" onClick={closeMenu} /><aside id="mobile-navigation" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu" tabIndex={-1} onKeyDown={trapFocus} className="fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-3rem)] flex-col border-r border-slate-200 bg-white shadow-lg"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><Brand onNavigate={closeMenu} /><Button variant="quiet" aria-label="Close navigation menu" onClick={closeMenu}>Close</Button></div><div className="flex-1 px-3 py-4"><NavigationLinks role={user.role} onNavigate={closeMenu} /></div><div className="border-t border-slate-200 p-4"><UserIdentity user={user} /><Button className="mt-4 w-full justify-start" variant="quiet" onClick={() => { onLogout(); closeMenu() }}>Log out {user.firstName}</Button></div></aside></>}</header>
}
