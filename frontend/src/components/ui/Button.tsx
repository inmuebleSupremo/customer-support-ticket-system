import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 focus-visible:outline-sky-700',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-sky-700',
  quiet: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-sky-700',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700'
}

export function Button({ children, className = '', type = 'button', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: ButtonVariant }) {
  return <button {...props} type={type} className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`.trim()}>{children}</button>
}
