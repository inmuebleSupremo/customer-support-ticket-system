import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const registrationMessage = location.state as { registered?: boolean } | null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="login-title" className="mx-auto max-w-md space-y-6">
      <div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">ResolveDesk</p><h1 id="login-title" className="mt-2 text-3xl font-bold">Sign in</h1></div>
      {registrationMessage?.registered && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">Account created. You can now sign in.</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block font-medium" htmlFor="login-email">Email<input id="login-email" className="mt-1 block w-full rounded border p-2" type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label className="block font-medium" htmlFor="login-password">Password<input id="login-password" className="mt-1 block w-full rounded border p-2" type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <button className="rounded bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p>Need an account? <Link className="text-sky-700 underline" to="/register">Register</Link></p>
    </section>
  )
}
