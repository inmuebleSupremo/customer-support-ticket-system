import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { ApiError } from '../../api/client'
import { useAuth } from './AuthContext'
import { AuthSurface } from './AuthSurface'

type FieldName = 'firstName' | 'lastName' | 'email' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

function validate(firstName: string, lastName: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!lastName.trim()) errors.lastName = 'Enter your last name.'
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (password.length < 12) errors.password = 'Use at least 12 characters for your password.'
  return errors
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(firstName, lastName, email, password)
    setFieldErrors(validationErrors)
    setError(null)
    if (Object.keys(validationErrors).length > 0) return
    setSubmitting(true)
    try {
      await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setFieldErrors(requestError.problem.fieldErrors ?? {})
        setError(requestError.problem.detail ?? 'Unable to create your account.')
      } else setError('Unable to create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return <AuthSurface title="Create an account" description="Set up your customer account to create and follow support requests."><div className="space-y-5">{error && <Alert tone="danger">{error}</Alert>}<form className="space-y-4" noValidate onSubmit={handleSubmit} aria-busy={submitting}><div className="grid gap-4 sm:grid-cols-2"><Field id="first-name" label="First name" value={firstName} error={fieldErrors.firstName} onChange={setFirstName} autoComplete="given-name" /><Field id="last-name" label="Last name" value={lastName} error={fieldErrors.lastName} onChange={setLastName} autoComplete="family-name" /></div><div><label className="rd-label" htmlFor="register-email">Email</label><input id="register-email" className="rd-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'register-email-help register-email-error' : 'register-email-help'} /><p id="register-email-help" className="mt-1 text-xs leading-5 text-slate-500">Use an address you can access for account support.</p>{fieldErrors.email && <p id="register-email-error" className="rd-validation-message">{fieldErrors.email}</p>}</div><div><label className="rd-label" htmlFor="register-password">Password</label><input id="register-password" className="rd-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'register-password-help register-password-error' : 'register-password-help'} /><p id="register-password-help" className="mt-1 text-xs leading-5 text-slate-500">Use at least 12 characters.</p>{fieldErrors.password && <p id="register-password-error" className="rd-validation-message">{fieldErrors.password}</p>}</div><Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button></form><p className="border-t border-slate-200 pt-5 text-center text-sm text-slate-600">Already have an account? <Link className="font-semibold text-sky-800 underline underline-offset-2" to="/login">Sign in</Link></p></div></AuthSurface>
}

function Field({ autoComplete, error, id, label, onChange, value }: { autoComplete: string; error?: string; id: string; label: string; onChange: (value: string) => void; value: string }) {
  const errorId = `${id}-error`
  return <div><label className="rd-label" htmlFor={id}>{label}</label><input id={id} className="rd-input" autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} maxLength={100} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <p id={errorId} className="rd-validation-message">{error}</p>}</div>
}
