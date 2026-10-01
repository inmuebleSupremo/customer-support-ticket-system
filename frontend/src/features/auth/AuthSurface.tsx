import type { ReactNode } from 'react'
import { Panel } from '../../components/ui/Panel'

export function AuthSurface({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return <section aria-labelledby="auth-title" className="mx-auto max-w-lg py-4 sm:py-10"><div className="mb-7 text-center"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">ResolveDesk</p><h1 id="auth-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p></div><Panel className="border-slate-300 p-5 sm:p-6">{children}</Panel><p className="mt-5 text-center text-xs leading-5 text-slate-500">ResolveDesk keeps your support requests, messages, and progress in one place.</p></section>
}
