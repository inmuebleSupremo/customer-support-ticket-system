import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { createTicket } from '../../api/tickets'

type FieldErrors = Partial<Record<'title' | 'description', string>>

function validate(title: string, description: string): FieldErrors {
  const errors: FieldErrors = {}
  if (title.trim().length < 3 || title.trim().length > 120) errors.title = 'Title must be between 3 and 120 characters.'
  if (description.trim().length < 10 || description.trim().length > 5000) errors.description = 'Description must be between 10 and 5000 characters.'
  return errors
}

export function CreateTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(title, description)
    setFieldErrors(validationErrors)
    setError(null)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      const ticket = await createTicket({ title: title.trim(), description: description.trim() })
      navigate(`/tickets/created/${ticket.id}`, { replace: true, state: { ticket } })
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setFieldErrors(requestError.problem.fieldErrors ?? {})
        setError(requestError.problem.detail ?? 'Unable to create your ticket.')
      } else {
        setError('Unable to create your ticket.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="create-ticket-title" className="mx-auto max-w-2xl space-y-6">
      <div><p className="text-sm font-medium uppercase tracking-wide text-sky-700">Customer support</p><h1 id="create-ticket-title" className="mt-2 text-3xl font-bold">Create a ticket</h1><p className="mt-2 text-slate-600">Describe the issue and the support team will review it.</p></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <label className="block font-medium" htmlFor="ticket-title">Title<input id="ticket-title" className="mt-1 block w-full rounded border p-2" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} aria-describedby={fieldErrors.title ? 'ticket-title-error' : undefined} /></label>
        {fieldErrors.title && <p id="ticket-title-error" role="alert" className="text-sm text-red-700">{fieldErrors.title}</p>}
        <label className="block font-medium" htmlFor="ticket-description">Description<textarea id="ticket-description" className="mt-1 block min-h-40 w-full rounded border p-2" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} aria-describedby={fieldErrors.description ? 'ticket-description-error' : undefined} /></label>
        {fieldErrors.description && <p id="ticket-description-error" role="alert" className="text-sm text-red-700">{fieldErrors.description}</p>}
        <button className="rounded bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Creating ticket…' : 'Create ticket'}</button>
      </form>
    </section>
  )
}
