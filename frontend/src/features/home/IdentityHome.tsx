import { ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../auth/AuthContext'
import { CustomerDashboard } from './CustomerDashboard'

export function IdentityHome() {
  const { user } = useAuth()
  if (user?.role === 'CUSTOMER') return <CustomerDashboard user={user} />
  const isAdministrator = user?.role === 'ADMIN'
  return <section aria-labelledby="welcome-title" className="mx-auto max-w-3xl space-y-6"><PageHeader id="welcome-title" eyebrow="Signed in" title={`Welcome, ${user?.firstName}.`}>Your ResolveDesk session is active.</PageHeader><Panel><h2 className="text-lg font-semibold text-slate-950">Continue working</h2><p className="mt-1 text-sm leading-6 text-slate-600">Review the current support queue or manage user access.</p><div className="mt-5 flex flex-wrap gap-3"><ButtonLink to="/queue">View support queue</ButtonLink>{isAdministrator && <ButtonLink variant="secondary" to="/admin/users">Manage users</ButtonLink>}</div></Panel></section>
}
