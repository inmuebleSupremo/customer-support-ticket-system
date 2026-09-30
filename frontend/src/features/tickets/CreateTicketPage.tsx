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

  return <section className="mx-auto max-w-3xl space-y-6" aria-labelledby="create-ticket-title"><PageHeader id="create-ticket-title" eyebrow="Your support space" title="Create a ticket" meta="New request">Tell us what you need help with. A clear title and description give the support team the context to begin.</PageHeader>{error && <Alert tone="danger">{error}</Alert>}<Panel className="border-slate-300"><div><p className="rd-meta-label">Request details</p><h2 className="mt-1 text-lg font-semibold text-slate-950">What can we help with?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Share the issue, relevant context, and what you expected to happen.</p></div><form className="mt-6 space-y-6" noValidate onSubmit={handleSubmit} aria-busy={submitting}><fieldset className="space-y-5"><legend className="sr-only">Ticket details</legend><div><div className="flex flex-wrap items-baseline justify-between gap-2"><label className="rd-label" htmlFor="ticket-title">Title</label><span className="text-xs text-slate-500">3–120 characters</span></div><input id="ticket-title" className="rd-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'ticket-title-help ticket-title-error' : 'ticket-title-help'} /><p id="ticket-title-help" className="mt-1 text-xs leading-5 text-slate-500">Use a short summary, such as “Unable to sign in”.</p>{fieldErrors.title && <p id="ticket-title-error" className="rd-validation-message">{fieldErrors.title}</p>}</div><div><div className="flex flex-wrap items-baseline justify-between gap-2"><label className="rd-label" htmlFor="ticket-description">Description</label><span className="text-xs text-slate-500">{description.length}/5000</span></div><textarea id="ticket-description" className="rd-textarea min-h-52" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'ticket-description-help ticket-description-error' : 'ticket-description-help'} /><p id="ticket-description-help" className="mt-1 text-xs leading-5 text-slate-500">Include relevant context, any error messages, and what you expected to happen.</p>{fieldErrors.description && <p id="ticket-description-error" className="rd-validation-message">{fieldErrors.description}</p>}</div></fieldset><div className="border-t border-slate-200 pt-5"><p className="text-sm text-slate-600">After you create the ticket, you’ll be taken to its page to follow the conversation and updates.</p><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end"><ButtonLink className="w-full sm:w-auto" variant="secondary" to="/tickets">Cancel</ButtonLink><Button className="w-full sm:w-auto" type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Creating ticket…' : 'Create ticket'}</Button></div></div></form></Panel></section>
}
