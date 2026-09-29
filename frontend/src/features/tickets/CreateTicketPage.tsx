import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
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
      navigate(`/tickets/${ticket.id}`, { replace: true })
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setFieldErrors(requestError.problem.fieldErrors ?? {})
        setError(requestError.problem.detail ?? 'Unable to create your ticket.')
      } else setError('Unable to create your ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="mx-auto max-w-3xl space-y-6" aria-labelledby="create-ticket-title"><PageHeader id="create-ticket-title" eyebrow="Customer support" title="Create a ticket">Describe the issue clearly so the support team can begin helping you.</PageHeader>{error && <Alert tone="danger">{error}</Alert>}<Panel><form className="space-y-5" noValidate onSubmit={handleSubmit} aria-busy={submitting}><div><label className="rd-label" htmlFor="ticket-title">Title</label><input id="ticket-title" className="rd-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'ticket-title-error' : undefined} />{fieldErrors.title && <p id="ticket-title-error" className="rd-validation-message">{fieldErrors.title}</p>}</div><div><label className="rd-label" htmlFor="ticket-description">Description</label><textarea id="ticket-description" className="rd-textarea min-h-48" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'ticket-description-error' : 'ticket-description-help'} /><div className="mt-1 flex justify-between gap-4 text-xs leading-5 text-slate-500"><p id="ticket-description-help">Include the relevant context and what you expected to happen.</p><p>{description.length}/5000</p></div>{fieldErrors.description && <p id="ticket-description-error" className="rd-validation-message">{fieldErrors.description}</p>}</div><div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5"><ButtonLink variant="secondary" to="/tickets">Cancel</ButtonLink><Button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Creating ticket…' : 'Create ticket'}</Button></div></form></Panel></section>
}
