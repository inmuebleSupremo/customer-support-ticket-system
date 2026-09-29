import type { ReactNode } from 'react'

export function PageHeader({ actions, eyebrow, title, children }: { actions?: ReactNode; eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div>{eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">{eyebrow}</p>}<h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">{title}</h1>{children && <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{children}</div>}</div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}</div>
}
