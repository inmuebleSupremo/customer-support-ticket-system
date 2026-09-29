import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from './router'
import type { CurrentUser } from '../api/auth'

const authenticatedUser = { id: 17, firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com', role: 'CUSTOMER' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const ticket = { id: 42, reference: 'SUP-42', title: 'Cannot sign in', description: 'I cannot sign in to my ResolveDesk account.', status: 'OPEN' as const, priority: 'MEDIUM' as const, customer: { id: 17, displayName: 'Alex Morgan' }, assignedAgent: null, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', resolvedAt: null, closedAt: null, version: 0 }
const createdHistory = [{ id: 700, eventType: 'TICKET_CREATED' as const, fieldName: null, oldValue: null, newValue: null, oldDisplayValue: null, newDisplayValue: null, actor: { id: 17, displayName: 'Alex Morgan' }, createdAt: '2026-09-29T10:00:00Z' }]

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
