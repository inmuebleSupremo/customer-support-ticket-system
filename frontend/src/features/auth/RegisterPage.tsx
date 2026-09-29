import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from './AuthContext'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({ firstName, lastName, email, password })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="register-title" className="mx-auto max-w-md space-y-6">
      <div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">ResolveDesk</p><h1 id="register-title" className="mt-2 text-3xl font-bold">Create an account</h1></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block font-medium" htmlFor="first-name">First name<input id="first-name" className="mt-1 block w-full rounded border p-2" value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={100} /></label>
        <label className="block font-medium" htmlFor="last-name">Last name<input id="last-name" className="mt-1 block w-full rounded border p-2" value={lastName} onChange={event => setLastName(event.target.value)} required maxLength={100} /></label>
        <label className="block font-medium" htmlFor="register-email">Email<input id="register-email" className="mt-1 block w-full rounded border p-2" type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label className="block font-medium" htmlFor="register-password">Password<input id="register-password" className="mt-1 block w-full rounded border p-2" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} /></label>
        <button className="rounded bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p>Already registered? <Link className="text-sky-700 underline" to="/login">Sign in</Link></p>
    </section>
  )
}
