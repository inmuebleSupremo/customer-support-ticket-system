import type { HTMLAttributes, ReactNode } from 'react'

export function Panel({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6 ${className}`.trim()}>{children}</div>
}
