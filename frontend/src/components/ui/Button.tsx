import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 focus-visible:outline-sky-700',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-sky-700',
  quiet: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-sky-700',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700'
}

function buttonClasses(variant: ButtonVariant, className: string) {
  return `inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`.trim()
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: ButtonVariant }>(function Button({ children, className = '', type = 'button', variant = 'primary', ...props }, ref) {
  return <button {...props} ref={ref} type={type} className={buttonClasses(variant, className)}>{children}</button>
})

export function ButtonLink({ children, className = '', variant = 'primary', ...props }: LinkProps & { children: ReactNode; variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClasses(variant, className)}>{children}</Link>
}
