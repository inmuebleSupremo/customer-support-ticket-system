import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from './router'
import type { CurrentUser } from '../api/auth'

const authenticatedUser = { id: 17, firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com', role: 'CUSTOMER' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const agentUser = { id: 8, firstName: 'Maria', lastName: 'Garcia', email: 'maria@example.com', role: 'AGENT' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const administratorUser = { id: 1, firstName: 'Ada', lastName: 'Admin', email: 'ada@example.com', role: 'ADMIN' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const ticket = { id: 42, reference: 'SUP-42', title: 'Cannot sign in', description: 'I cannot sign in to my ResolveDesk account.', status: 'OPEN' as const, priority: 'MEDIUM' as const, customer: { id: 17, displayName: 'Alex Morgan' }, assignedAgent: null, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', resolvedAt: null, closedAt: null, version: 0 }
const createdHistory = [{ id: 700, eventType: 'TICKET_CREATED' as const, fieldName: null, oldValue: null, newValue: null, oldDisplayValue: null, newDisplayValue: null, actor: { id: 17, displayName: 'Alex Morgan' }, createdAt: '2026-09-29T10:00:00Z' }]
const emptyComments = { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0, first: true, last: true }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('identity flow', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('restores an authenticated session on application load', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Welcome, Alex.' })).toBeInTheDocument()
  })

  it('redirects an anonymous visitor away from a protected route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('submits the login form through the shared API layer', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: authenticatedUser }))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Sign in' })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ExamplePassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Alex.' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/auth/login', expect.objectContaining({ credentials: 'include', method: 'POST' }))
  })

  it('submits the registration form and returns to login', async () => {
    window.history.replaceState({}, '', '/register')
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser, 201))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Create an account' })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Morgan' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ExamplePassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Account created. You can now sign in.')).toBeInTheDocument()
  })

  it('logs out through the shared API layer and returns to login', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Alex.' })
    fireEvent.click(screen.getByRole('button', { name: 'Log out Alex' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/auth/logout', expect.objectContaining({ credentials: 'include', method: 'POST' })))
  })
})

describe('customer ticket creation', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    window.history.replaceState({}, '', '/tickets/new')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreCustomerSession(user: CurrentUser = authenticatedUser) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(user))
  }

  it('renders the create-ticket form for an authenticated customer', async () => {
    restoreCustomerSession()
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Create a ticket' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('validates ticket fields before submission', async () => {
    restoreCustomerSession()
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Create a ticket' })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Too short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))
    expect(await screen.findByText('Title must be between 3 and 120 characters.')).toBeInTheDocument()
    expect(screen.getByText('Description must be between 10 and 5000 characters.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('submits a valid ticket through the shared API layer', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'submit-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket, 201))
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Create a ticket' })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cannot sign in' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'I cannot sign in to my ResolveDesk account.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))
    expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets', expect.objectContaining({ credentials: 'include', method: 'POST' }))
  })

  it('displays API validation errors', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'submit-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'One or more fields are invalid.', fieldErrors: { title: 'Title is required.' } }, 400))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Create a ticket' })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Valid title' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'This is a sufficiently long ticket description.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))
    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('One or more fields are invalid.')).toBeInTheDocument()
  })

  it('denies the customer-only route to authenticated non-customers', async () => {
    restoreCustomerSession({ ...authenticatedUser, role: 'AGENT' })
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })
})

describe('customer ticket workspace', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    window.history.replaceState({}, '', '/tickets')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreCustomerSession() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
  }

  it('renders a customer ticket list from the paginated API response', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: [ticket], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true }))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Your tickets' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /SUP-42/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets', expect.objectContaining({ credentials: 'include' }))
  })

  it('renders the empty ticket-list state', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }))
    render(<AppRouter />)
    expect(await screen.findByText('You have not created any tickets yet.')).toBeInTheDocument()
  })

  it('renders ticket details and their activity history', async () => {
    window.history.replaceState({}, '', '/tickets/42')
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
    expect(screen.getByText('I cannot sign in to my ResolveDesk account.')).toBeInTheDocument()
    expect(screen.getByText('Ticket Created')).toBeInTheDocument()
    expect(screen.getByText(/By Alex Morgan/)).toBeInTheDocument()
  })

  it('shows a loading state followed by a workspace error', async () => {
    restoreCustomerSession()
    let resolveTickets: (response: Response) => void = () => undefined
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { resolveTickets = resolve }))
    render(<AppRouter />)
    expect(await screen.findByText('Loading your tickets…')).toBeInTheDocument()
    resolveTickets(jsonResponse({ detail: 'Tickets are temporarily unavailable.' }, 500))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tickets are temporarily unavailable.')
  })

  it('keeps workspace routes protected for non-customers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...authenticatedUser, role: 'AGENT' }))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })
})

describe('agent ticket queue', () => {
  const fetchMock = vi.fn()
  const queuePage = { content: [{ ...ticket, assignedAgent: { id: 8, displayName: 'Maria Garcia' } }], page: 0, size: 20, totalElements: 21, totalPages: 2, first: true, last: false }
  const agents = [{ id: 8, displayName: 'Maria Garcia', email: 'maria@example.com' }]

  beforeEach(() => {
    window.history.replaceState({}, '', '/queue')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreAgentSession() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(agentUser))
  }

  it('renders the support queue as a table for an agent', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Ticket queue' })).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Maria Garcia')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agents', expect.objectContaining({ credentials: 'include' }))
  })

  it('renders the empty queue state', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    render(<AppRouter />)
    expect(await screen.findByText('No tickets match the current queue filters.')).toBeInTheDocument()
  })

  it('submits filters, reference search, and sort changes through the API layer', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'OPEN' } })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } })
    fireEvent.change(screen.getByLabelText('Assigned agent'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'SUP-42' } })
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'title,asc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?status=OPEN&priority=HIGH&assignedAgentId=8&search=SUP-42&page=0&sort=title%2Casc', expect.objectContaining({ credentials: 'include' })))
  })

  it('requests the next page and navigates to a queue ticket detail', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...queuePage, page: 1, first: false, last: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?page=1&sort=updatedAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
    fireEvent.click(screen.getByRole('link', { name: 'SUP-42' }))
    expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to support queue' })).toBeInTheDocument()
  })

  it('keeps the queue route unavailable to customers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })
})

describe('ticket assignment and lifecycle controls', () => {
  const fetchMock = vi.fn()
  const agents = [{ id: 8, displayName: 'Maria Garcia', email: 'maria@example.com' }]

  beforeEach(() => {
    window.history.replaceState({}, '', '/tickets/42')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreSession(user: CurrentUser = agentUser) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(user))
  }

  it('shows staff assignment and only valid status actions, then submits through the API layer', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'change-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', status: 'IN_PROGRESS', resolvedAt: null, closedAt: null, updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, status: 'IN_PROGRESS', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Ticket actions' })).toBeInTheDocument()
    expect(screen.getByLabelText('Assigned agent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change status to IN PROGRESS' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change status to IN PROGRESS' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS', version: 0 }) })))
    expect(await screen.findByRole('button', { name: 'Change status to RESOLVED' })).toBeInTheDocument()
  })

  it('assigns a ticket from the active-agent lookup through the shared API layer', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'change-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', assignedAgent: { id: 8, displayName: 'Maria Garcia' }, updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, assignedAgent: { id: 8, displayName: 'Maria Garcia' }, version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket actions' })
    fireEvent.change(screen.getByLabelText('Assigned agent'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update assignment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/assignee', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ agentId: 8, version: 0 }) })))
  })

  it('allows a customer to reopen only a resolved ticket and handles stale changes by reloading', async () => {
    restoreSession(authenticatedUser)
    const resolvedTicket = { ...ticket, status: 'RESOLVED' as const, resolvedAt: '2026-09-29T10:00:00Z', version: 2 }
    fetchMock.mockResolvedValueOnce(jsonResponse(resolvedTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'change-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'STALE_RESOURCE', detail: 'Ticket has changed' }, 409))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...resolvedTicket, version: 3 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByRole('button', { name: 'Change status to IN PROGRESS' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Assigned agent')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change status to IN PROGRESS' }))
    expect(await screen.findByText('This ticket changed while you were viewing it. The latest version has been loaded.')).toBeInTheDocument()
  })

  it('hides all mutation controls for a closed ticket', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, status: 'CLOSED' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ticket actions' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Change priority')).not.toBeInTheDocument()
  })
})

describe('ticket conversation', () => {
  const fetchMock = vi.fn()
  const comments = { content: [{ id: 301, author: { id: 8, displayName: 'Maria Garcia', role: 'AGENT' as const }, content: 'I am investigating this issue.', createdAt: '2026-09-29T10:05:00Z' }], page: 0, size: 50, totalElements: 1, totalPages: 1, first: true, last: true }

  beforeEach(() => {
    window.history.replaceState({}, '', '/tickets/42')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreCustomerSession() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
  }

  it('renders chronological comments with author roles and an eligible add-comment form', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(comments))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Conversation' })).toBeInTheDocument()
    expect(screen.getByText('I am investigating this issue.')).toBeInTheDocument()
    expect(screen.getByText('(AGENT)')).toBeInTheDocument()
    expect(screen.getByLabelText('Add a comment')).toBeInTheDocument()
  })

  it('shows the empty state and validates a client comment before submitting', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByText('No comments have been added yet.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))
    expect(await screen.findByText('Comment content is required.')).toBeInTheDocument()
  })

  it('submits a comment through the shared CSRF API layer and refreshes ticket activity', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'comment-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(comments.content[0], 201))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, updatedAt: '2026-09-29T10:05:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(comments))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Conversation' })
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Please keep me updated.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/comments', expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: 'Please keep me updated.' }) })))
    expect(await screen.findByText('I am investigating this issue.')).toBeInTheDocument()
  })

  it('keeps closed conversations read-only and displays comment API errors', async () => {
    restoreCustomerSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, status: 'CLOSED' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Conversation is unavailable.' }, 500))
    render(<AppRouter />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Conversation is unavailable.')
    expect(screen.queryByRole('button', { name: 'Add comment' })).not.toBeInTheDocument()
  })
})

describe('ticket priority controls', () => {
  const fetchMock = vi.fn()
  const agents = [{ id: 8, displayName: 'Maria Garcia', email: 'maria@example.com' }]

  beforeEach(() => {
    window.history.replaceState({}, '', '/tickets/42')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreSession(user: CurrentUser) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(user))
  }

  function loadStaffTicket(ticketResponse = ticket) {
    fetchMock.mockResolvedValueOnce(jsonResponse(ticketResponse))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
  }

  it('shows the current priority and lets an agent change it through the shared API layer', async () => {
    restoreSession(agentUser)
    loadStaffTicket()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'priority-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', priority: 'URGENT', updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, priority: 'URGENT', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    render(<AppRouter />)
    expect(await screen.findByText('MEDIUM')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Change priority'), { target: { value: 'URGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update priority' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/priority', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ priority: 'URGENT', version: 0 }) })))
    expect(await screen.findByText('URGENT')).toBeInTheDocument()
  })

  it('allows an administrator but never exposes priority mutation to customers or closed tickets', async () => {
    restoreSession({ ...agentUser, role: 'ADMIN' })
    loadStaffTicket()
    render(<AppRouter />)
    expect(await screen.findByLabelText('Change priority')).toBeInTheDocument()
  })

  it('keeps customer and closed-ticket priority displays read-only', async () => {
    restoreSession(authenticatedUser)
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByText('MEDIUM')).toBeInTheDocument()
    expect(screen.queryByLabelText('Change priority')).not.toBeInTheDocument()
  })

  it('reloads after a stale priority response and displays API errors', async () => {
    restoreSession(agentUser)
    loadStaffTicket()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'priority-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'STALE_RESOURCE', detail: 'Ticket has changed' }, 409))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, priority: 'HIGH', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    render(<AppRouter />)
    await screen.findByLabelText('Change priority')
    fireEvent.change(screen.getByLabelText('Change priority'), { target: { value: 'URGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update priority' }))
    expect(await screen.findByText('This ticket changed while you were viewing it. The latest version has been loaded.')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })
})

describe('user administration', () => {
  const fetchMock = vi.fn()
  const managedUsers = {
    content: [
      administratorUser,
      { id: 8, firstName: 'Maria', lastName: 'Garcia', email: 'maria@example.com', role: 'AGENT' as const, active: true, createdAt: '2026-09-28T10:00:00Z' }
    ],
    page: 0,
    size: 20,
    totalElements: 21,
    totalPages: 2,
    first: true,
    last: false
  }

  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/users')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreAdminSession() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(administratorUser))
  }

  it('renders the administrator user list, applies filters, and changes pages through the API layer', async () => {
    restoreAdminSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...managedUsers, page: 1, first: false, last: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...managedUsers, content: [managedUsers.content[1]], totalElements: 1, totalPages: 1, last: true }))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'User administration' })).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?page=1&sort=createdAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'AGENT' } })
    fireEvent.change(screen.getByLabelText('Account status'), { target: { value: 'true' } })
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?role=AGENT&active=true&search=maria&page=0&sort=createdAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
  })

  it('updates roles and account activation through the shared CSRF API layer', async () => {
    restoreAdminSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'role-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...managedUsers.content[1], role: 'ADMIN' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'active-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...managedUsers.content[1], role: 'ADMIN', active: false }))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'User administration' })
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Role for maria@example.com'), { target: { value: 'ADMIN' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Update role' })[1])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/8/role', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'ADMIN' }) })))
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[1])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/8/active', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) })))
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('displays final-administrator and assigned-agent business conflicts', async () => {
    restoreAdminSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'admin-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'LAST_ACTIVE_ADMIN', detail: 'Cannot deactivate final admin.' }, 409))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'agent-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AGENT_HAS_ACTIVE_TICKETS', detail: 'Reassign the agent first.' }, 409))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'User administration' })
    await screen.findByRole('table')
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('The final active administrator cannot be demoted or deactivated.')
    fireEvent.change(screen.getByLabelText('Role for maria@example.com'), { target: { value: 'CUSTOMER' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Update role' })[1])
    expect(await screen.findByRole('alert')).toHaveTextContent('Reassign the agent first.')
  })

  it('renders loading, empty, and error states', async () => {
    restoreAdminSession()
    let resolveUsers: (response: Response) => void = () => undefined
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { resolveUsers = resolve }))
    render(<AppRouter />)
    expect(await screen.findByText('Loading users…')).toBeInTheDocument()
    resolveUsers(jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }))
    expect(await screen.findByText('No users match the current filters.')).toBeInTheDocument()
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'User administration is temporarily unavailable.' }, 500))
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'AGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('User administration is temporarily unavailable.')
  })

  it('keeps the administration route unavailable to non-administrators', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(agentUser))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })
})
