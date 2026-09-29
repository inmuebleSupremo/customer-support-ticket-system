import type { ReactNode } from 'react'

type AlertTone = 'success' | 'warning' | 'danger' | 'info'

const alertTones: Record<AlertTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950'
}

export function Alert({ children, tone = 'info' }: { children: ReactNode; tone?: AlertTone }) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${alertTones[tone]}`}>{children}</div>
}

export function EmptyState({ action, children, title }: { action?: ReactNode; children: ReactNode; title: string }) {
  return <section className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center sm:px-8" aria-labelledby="empty-state-title"><h2 id="empty-state-title" className="text-lg font-semibold text-slate-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{children}</p>{action && <div className="mt-5">{action}</div>}</section>
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-sky-700" />{label}</span></div>
}
