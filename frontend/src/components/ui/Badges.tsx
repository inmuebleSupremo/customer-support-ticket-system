type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type UserRole = 'CUSTOMER' | 'AGENT' | 'ADMIN'

const badgeBase = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none'

function Badge({ children, className }: { children: string; className: string }) {
  return <span className={`${badgeBase} ${className}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>
}

const statuses: Record<TicketStatus, [string, string]> = {
  OPEN: ['Open', 'border-sky-200 bg-sky-50 text-sky-800'],
  IN_PROGRESS: ['In progress', 'border-indigo-200 bg-indigo-50 text-indigo-800'],
  RESOLVED: ['Resolved', 'border-emerald-200 bg-emerald-50 text-emerald-800'],
  CLOSED: ['Closed', 'border-slate-200 bg-slate-100 text-slate-700']
}

const priorities: Record<TicketPriority, [string, string]> = {
  LOW: ['Low', 'border-slate-200 bg-slate-100 text-slate-700'],
  MEDIUM: ['Medium', 'border-sky-200 bg-sky-50 text-sky-800'],
  HIGH: ['High', 'border-amber-200 bg-amber-50 text-amber-900'],
  URGENT: ['Urgent', 'border-red-200 bg-red-50 text-red-800']
}

const roles: Record<UserRole, [string, string]> = {
  CUSTOMER: ['Customer', 'border-slate-200 bg-slate-100 text-slate-700'],
  AGENT: ['Agent', 'border-sky-200 bg-sky-50 text-sky-800'],
  ADMIN: ['Administrator', 'border-violet-200 bg-violet-50 text-violet-800']
}

export function StatusBadge({ status }: { status: TicketStatus }) { const [label, className] = statuses[status]; return <Badge className={className}>{label}</Badge> }
export function PriorityBadge({ priority }: { priority: TicketPriority }) { const [label, className] = priorities[priority]; return <Badge className={className}>{label}</Badge> }
export function RoleBadge({ role }: { role: UserRole }) { const [label, className] = roles[role]; return <Badge className={className}>{label}</Badge> }
export function AccountStatusBadge({ active }: { active: boolean }) { return <Badge className={active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700'}>{active ? 'Active' : 'Inactive'}</Badge> }
