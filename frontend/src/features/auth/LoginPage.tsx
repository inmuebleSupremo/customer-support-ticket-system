import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { ApiError } from '../../api/client'
import { useAuth } from './AuthContext'
import { AuthSurface } from './AuthSurface'

type FieldErrors = Partial<Record<'email' | 'password', string>>

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const registrationMessage = location.state as { registered?: boolean } | null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(email, password)
    setFieldErrors(validationErrors)
    setError(null)
    if (Object.keys(validationErrors).length > 0) return
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      navigate('/', { replace: true })
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setFieldErrors(requestError.problem.fieldErrors ?? {})
        setError(requestError.problem.detail ?? 'Unable to sign in.')
      } else setError('Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return <AuthSurface title="Sign in" description="Continue to your ResolveDesk support workspace."><div className="space-y-5"><div><p className="rd-meta-label">Account access</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Welcome back</h2><p className="mt-1 text-sm leading-6 text-slate-600">Sign in to create requests, check progress, and continue conversations with support.</p></div>{registrationMessage?.registered && <Alert tone="success">Account created. You can now sign in.</Alert>}{error && <Alert tone="danger">{error}</Alert>}<form className="space-y-5" noValidate onSubmit={handleSubmit} aria-busy={submitting}><div><label className="rd-label" htmlFor="login-email">Email</label><input id="login-email" className="rd-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-help login-email-error' : 'login-email-help'} /><p id="login-email-help" className="mt-1 text-xs leading-5 text-slate-500">Use the email address associated with your customer account.</p>{fieldErrors.email && <p id="login-email-error" className="rd-validation-message">{fieldErrors.email}</p>}</div><div><label className="rd-label" htmlFor="login-password">Password</label><input id="login-password" className="rd-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} />{fieldErrors.password && <p id="login-password-error" className="rd-validation-message">{fieldErrors.password}</p>}</div><Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button></form><p className="border-t border-slate-200 pt-5 text-center text-sm leading-6 text-slate-600">New to ResolveDesk? <Link className="font-semibold text-sky-800 underline underline-offset-2" to="/register">Create a customer account</Link></p></div></AuthSurface>
}
