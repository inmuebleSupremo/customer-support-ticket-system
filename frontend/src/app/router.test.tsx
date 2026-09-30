import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from './router'
import type { CurrentUser } from '../api/auth'

const authenticatedUser = { id: 17, firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com', role: 'CUSTOMER' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const agentUser = { id: 8, firstName: 'Maria', lastName: 'Garcia', email: 'maria@example.com', role: 'AGENT' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const administratorUser = { id: 1, firstName: 'Ada', lastName: 'Admin', email: 'ada@example.com', role: 'ADMIN' as const, active: true, createdAt: '2026-09-29T10:00:00Z' }
const ticket = { id: 42, reference: 'SUP-42', title: 'Cannot sign in', description: 'I cannot sign in to my ResolveDesk account.', status: 'OPEN' as const, priority: 'MEDIUM' as const, customer: { id: 17, displayName: 'Alex Morgan' }, assignedAgent: null, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', resolvedAt: null, closedAt: null, version: 0 }
const createdHistory = [{ id: 700, eventType: 'TICKET_CREATED' as const, fieldName: null, oldValue: null, newValue: null, oldDisplayValue: null, newDisplayValue: null, actor: { id: 17, displayName: 'Alex Morgan' }, createdAt: '2026-09-29T10:00:00Z' }]
const emptyComments = { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0, first: true, last: true }
const emptyTicketPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }

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
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ credentials: 'include', method: 'POST' }))
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
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/auth/csrf') return Promise.resolve(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
      if (url === '/api/v1/users/me') return Promise.resolve(jsonResponse(authenticatedUser))
      if (url === '/api/v1/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
      if (url.startsWith('/api/v1/tickets')) return Promise.resolve(jsonResponse(emptyTicketPage))
      return Promise.resolve(jsonResponse({ detail: 'Unexpected request' }, 500))
    })
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Alex.' })
    fireEvent.click(screen.getByRole('button', { name: 'Log out Alex' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/logout', expect.objectContaining({ credentials: 'include', method: 'POST' })))
  })

  it('shows local validation messages before submitting an incomplete login', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Sign in' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  it('shows registration guidance and validation before submitting incomplete details', async () => {
    window.history.replaceState({}, '', '/register')
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Create an account' })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 12 characters for your password.')).toBeInTheDocument()
    expect(screen.getByText('Use an address you can access for account support.')).toBeInTheDocument()
  })
})

describe('customer dashboard', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreCustomerDashboard(recent = { content: [ticket], page: 0, size: 5, totalElements: 1, totalPages: 1, first: true, last: true }) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))
    fetchMock.mockResolvedValueOnce(jsonResponse(recent))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...emptyTicketPage, totalElements: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyTicketPage))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyTicketPage))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyTicketPage))
  }

  it('renders a ticket overview and recent customer tickets from existing ticket data', async () => {
    restoreCustomerDashboard()
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Recent tickets' })).toBeInTheDocument()
    expect(screen.getByText('SUP-42')).toBeInTheDocument()
    expect(screen.getAllByText('Open')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets?status=OPEN&page=0&size=1', expect.objectContaining({ credentials: 'include' }))
  })

  it('shows a useful empty state when the customer has no tickets', async () => {
    restoreCustomerDashboard({ ...emptyTicketPage, size: 5 })
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'No support requests yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your first ticket' })).toBeInTheDocument()
  })
})

describe('application navigation', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function restoreSession(user: CurrentUser) {
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(user))
  }

  it('shows only customer destinations, identity, and role context', async () => {
    restoreSession(authenticatedUser)
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Alex.' })
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(within(navigation).getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'My Tickets' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'Create Ticket' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Support Queue' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'User Administration' })).not.toBeInTheDocument()
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    expect(screen.getByText('Customer')).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows agent destinations without customer or administration destinations', async () => {
    restoreSession(agentUser)
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Maria.' })
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(within(navigation).getByRole('link', { name: 'Support Queue' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'User Administration' })).not.toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('shows administrator destinations without customer destinations', async () => {
    restoreSession(administratorUser)
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Ada.' })
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(within(navigation).getByRole('link', { name: 'Support Queue' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'User Administration' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
  })

  it('marks the current customer workspace destination as active', async () => {
    window.history.replaceState({}, '', '/tickets')
    restoreSession(authenticatedUser)
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Your tickets' })
    expect(screen.getByRole('navigation', { name: 'Primary navigation' }).querySelector('[aria-current="page"]')).toHaveTextContent('My Tickets')
  })

  it('opens and closes the mobile drawer, restoring focus after route selection', async () => {
    restoreSession(authenticatedUser)
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Welcome, Alex.' })
    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(menuButton)
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' })
    expect(drawer).toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('link', { name: 'My Tickets' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument())
    expect(menuButton).toHaveFocus()
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
    expect(await screen.findAllByRole('link', { name: /SUP-42/ })).toHaveLength(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?page=0&size=20&sort=updatedAt%2Cdesc', expect.objectContaining({ credentials: 'include' }))
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
  const queuePage = { content: [{ ...ticket, assignedAgent: { id: 8, displayName: 'Maria Garcia' }, assignedTeam: { id: 3, name: 'Platform Support' } }], page: 0, size: 20, totalElements: 21, totalPages: 2, first: true, last: false }
  const agents = [{ id: 8, displayName: 'Maria Garcia', email: 'maria@example.com' }]
  const teams = [{ id: 3, name: 'Platform Support' }]

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
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Ticket queue' })).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Maria Garcia')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Platform Support')).toBeInTheDocument()
    expect(screen.getByText(/Team: Platform Support/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agents', expect.objectContaining({ credentials: 'include' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/teams', expect.objectContaining({ credentials: 'include' }))
    expect(screen.getByRole('option', { name: 'All teams' })).toBeInTheDocument()
  })

  it('renders the empty queue state', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'No matching tickets' })).toBeInTheDocument()
  })

  it('submits filters, reference search, and sort changes through the API layer', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'OPEN' } })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } })
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Assigned agent'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Search tickets'), { target: { value: 'SUP-42' } })
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'title,asc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?status=OPEN&priority=HIGH&assignedAgentId=8&teamId=3&search=SUP-42&page=0&sort=title%2Casc', expect.objectContaining({ credentials: 'include' })))
  })

  it('submits the unrouted filter without a specific team', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('Unrouted / No team'))
    expect(screen.getByLabelText('Team')).toBeDisabled()
    expect(screen.getByLabelText('Team')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?unassignedTeam=true&page=0&sort=updatedAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
  })

  it('submits My Teams without a specific or unrouted team filter', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('My Teams'))
    expect(screen.getByLabelText('Team')).toBeDisabled()
    expect(screen.getByLabelText('Team')).toHaveValue('')
    expect(screen.getByLabelText('Unrouted / No team')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?myTeams=true&page=0&sort=updatedAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
    fireEvent.click(screen.getByLabelText('Unrouted / No team'))
    expect(screen.getByLabelText('My Teams')).not.toBeChecked()
  })

  it('clears active filters and reloads the default queue', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket queue' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'OPEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tickets?page=0&sort=updatedAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
  })

  it('requests the next page and navigates to a queue ticket detail', async () => {
    restoreAgentSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePage))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...queuePage, page: 1, first: false, last: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
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
  const teams = [{ id: 3, name: 'Billing' }, { id: 4, name: 'Technical' }]

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
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'change-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', status: 'IN_PROGRESS', resolvedAt: null, closedAt: null, updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, status: 'IN_PROGRESS', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Ticket actions' })).toBeInTheDocument()
    expect(screen.getByLabelText('Assigned agent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change status to In Progress' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change status to In Progress' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS', version: 0 }) })))
    expect(await screen.findByRole('button', { name: 'Change status to Resolved' })).toBeInTheDocument()
  })

  it('assigns a ticket from the active-agent lookup through the shared API layer', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'change-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', assignedAgent: { id: 8, displayName: 'Maria Garcia' }, updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, assignedAgent: { id: 8, displayName: 'Maria Garcia' }, version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    await screen.findByRole('heading', { name: 'Ticket actions' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agents', expect.objectContaining({ credentials: 'include' }))
    fireEvent.change(screen.getByLabelText('Assigned agent'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update assignment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/assignee', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ agentId: 8, version: 0 }) })))
  })

  it('loads only the assigned team\'s active agents and permits an eligible agent to assign themselves', async () => {
    restoreSession()
    const routedTicket = { ...ticket, assignedTeam: { id: 3, name: 'Billing' } }
    fetchMock.mockResolvedValueOnce(jsonResponse(routedTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByLabelText('Assigned agent')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/agents?teamId=3', expect.objectContaining({ credentials: 'include' }))
    expect(screen.getByRole('option', { name: 'Maria Garcia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeEnabled()
  })

  it('disables Assign to me when the current agent is not eligible for the assigned team', async () => {
    restoreSession()
    const routedTicket = { ...ticket, assignedTeam: { id: 3, name: 'Billing' } }
    const teamAgents = [{ id: 9, displayName: 'Other Agent', email: 'other@example.com' }]
    fetchMock.mockResolvedValueOnce(jsonResponse(routedTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(teamAgents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByRole('option', { name: 'Other Agent' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Maria Garcia' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeDisabled()
  })

  it('surfaces ASSIGNEE_NOT_IN_TEAM through the existing mutation feedback', async () => {
    restoreSession()
    const routedTicket = { ...ticket, assignedTeam: { id: 3, name: 'Billing' } }
    fetchMock.mockResolvedValueOnce(jsonResponse(routedTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'assignment-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'ASSIGNEE_NOT_IN_TEAM', detail: 'The selected agent is not a member of the assigned team.' }, 409))
    render(<AppRouter />)
    await screen.findByLabelText('Assigned agent')
    fireEvent.change(screen.getByLabelText('Assigned agent'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update assignment' }))
    expect(await screen.findByText('The selected agent is not a member of the assigned team.')).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: 'Change status to In Progress' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Assigned agent')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change status to In Progress' }))
    expect(await screen.findByText('This ticket changed while you were viewing it. The latest version has been loaded.')).toBeInTheDocument()
  })

  it('hides all mutation controls for a closed ticket', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, status: 'CLOSED' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ticket actions' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assigned team')).not.toBeInTheDocument()
  })

  it('shows Unrouted when a ticket has no assigned team', async () => {
    restoreSession(authenticatedUser)
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByRole('heading', { name: 'Ticket details' })).toBeInTheDocument()
    expect(screen.getByText('Assigned team')).toBeInTheDocument()
    expect(screen.getByText('Unrouted')).toBeInTheDocument()
  })

  it('shows the assigned team and its human-readable activity change', async () => {
    restoreSession()
    const routedTicket = { ...ticket, assignedTeam: { id: 3, name: 'Billing' } }
    const teamHistory = [{ id: 701, eventType: 'TEAM_CHANGED' as const, fieldName: 'assignedTeam', oldValue: '2', newValue: '3', oldDisplayValue: 'Technical', newDisplayValue: 'Billing', actor: { id: 8, displayName: 'Maria Garcia' }, createdAt: '2026-09-29T10:01:00Z' }]
    fetchMock.mockResolvedValueOnce(jsonResponse(routedTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(teamHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByText('changed the assigned team')).toBeInTheDocument()
    expect(screen.getByText('Technical → Billing')).toBeInTheDocument()
    expect(screen.getAllByText('Billing')).not.toHaveLength(0)
  })

  it('routes a ticket to an active team and can clear the route', async () => {
    restoreSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'team-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', assignedTeam: { id: 3, name: 'Billing' }, assignedAgent: null, updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, assignedTeam: { id: 3, name: 'Billing' }, version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'team-clear-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', assignedTeam: null, assignedAgent: null, updatedAt: '2026-09-29T10:02:00Z', version: 2 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, assignedTeam: null, version: 2 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    render(<AppRouter />)
    expect(await screen.findByLabelText('Assigned team')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Billing' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Assigned team'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update team' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/team', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ teamId: 3, version: 0 }) })))
    await waitFor(() => expect(screen.getByLabelText('Assigned team')).toHaveValue('3'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/agents?teamId=3', expect.objectContaining({ credentials: 'include' })))
    fireEvent.change(screen.getByLabelText('Assigned team'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update team' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/team', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ teamId: null, version: 1 }) })))
    await waitFor(() => expect(screen.getByLabelText('Assigned team')).toHaveValue(''))
  })

  it('reloads the ticket after a stale team-route response', async () => {
    restoreSession()
    const technicalTicket = { ...ticket, assignedTeam: { id: 4, name: 'Technical' } }
    fetchMock.mockResolvedValueOnce(jsonResponse(technicalTicket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    fetchMock.mockResolvedValueOnce(jsonResponse(agents))
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'team-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'STALE_RESOURCE', detail: 'Ticket has changed' }, 409))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...technicalTicket, version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    render(<AppRouter />)
    expect(await screen.findByLabelText('Assigned team')).toHaveValue('4')
    fireEvent.change(screen.getByLabelText('Assigned team'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update team' }))
    expect(await screen.findByText('This ticket changed while you were viewing it. The latest version has been loaded.')).toBeInTheDocument()
    expect(screen.getByLabelText('Assigned team')).toHaveValue('4')
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
    expect(screen.getByText('Agent')).toBeInTheDocument()
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
  const teams = [{ id: 3, name: 'Billing' }]

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
    fetchMock.mockResolvedValueOnce(jsonResponse(teams))
  }

  it('shows the current priority and lets an agent change it through the shared API layer', async () => {
    restoreSession(agentUser)
    loadStaffTicket()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'priority-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, reference: 'SUP-42', priority: 'URGENT', updatedAt: '2026-09-29T10:01:00Z', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, priority: 'URGENT', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    render(<AppRouter />)
    expect(await screen.findAllByText('Medium')).not.toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'URGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update priority' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/tickets/42/priority', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ priority: 'URGENT', version: 0 }) })))
    expect(await screen.findAllByText('Urgent')).not.toHaveLength(0)
  })

  it('allows an administrator but never exposes priority mutation to customers or closed tickets', async () => {
    restoreSession({ ...agentUser, role: 'ADMIN' })
    loadStaffTicket()
    render(<AppRouter />)
    expect(await screen.findByLabelText('Priority')).toBeInTheDocument()
  })

  it('keeps customer and closed-ticket priority displays read-only', async () => {
    restoreSession(authenticatedUser)
    fetchMock.mockResolvedValueOnce(jsonResponse(ticket))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyComments))
    render(<AppRouter />)
    expect(await screen.findByText('Medium')).toBeInTheDocument()
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument()
  })

  it('reloads after a stale priority response and displays API errors', async () => {
    restoreSession(agentUser)
    loadStaffTicket()
    fetchMock.mockResolvedValueOnce(jsonResponse({ headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'priority-token' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'STALE_RESOURCE', detail: 'Ticket has changed' }, 409))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...ticket, priority: 'HIGH', version: 1 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(createdHistory))
    render(<AppRouter />)
    await screen.findByLabelText('Priority')
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'URGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update priority' }))
    expect(await screen.findByText('This ticket changed while you were viewing it. The latest version has been loaded.')).toBeInTheDocument()
    expect(screen.getAllByText('High')).not.toHaveLength(0)
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
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Maria Garcia')).toBeInTheDocument()
    expect(within(table).getAllByText('Administrator')).not.toHaveLength(0)
    expect(within(table).getAllByText('Active')).not.toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?page=1&sort=createdAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'AGENT' } })
    fireEvent.change(screen.getByLabelText('Account status'), { target: { value: 'true' } })
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?role=AGENT&active=true&search=maria&page=0&sort=createdAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
  })

  it('clears active administration filters back to the default query', async () => {
    restoreAdminSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    render(<AppRouter />)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'AGENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?page=0&sort=createdAt%2Cdesc', expect.objectContaining({ credentials: 'include' })))
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
    const table = await screen.findByRole('table')
    fireEvent.change(within(table).getByLabelText('Role for maria@example.com'), { target: { value: 'ADMIN' } })
    fireEvent.click(within(table).getAllByRole('button', { name: 'Update role' })[1])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/8/role', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'ADMIN' }) })))
    fireEvent.click(within(table).getAllByRole('button', { name: 'Deactivate' })[1])
    expect(await screen.findByRole('alertdialog', { name: 'Deactivate Maria Garcia?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/8/active', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) })))
    expect(await within(table).findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('requires confirmation before deactivating an account and supports cancellation', async () => {
    restoreAdminSession()
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUsers))
    render(<AppRouter />)
    const table = await screen.findByRole('table')
    fireEvent.click(within(table).getAllByRole('button', { name: 'Deactivate' })[1])
    const confirmation = await screen.findByRole('alertdialog', { name: 'Deactivate Maria Garcia?' })
    expect(confirmation).toHaveTextContent('This disables their ResolveDesk access.')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/users/8/active', expect.anything())
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
    const table = await screen.findByRole('table')
    fireEvent.click(within(table).getAllByRole('button', { name: 'Deactivate' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate account' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('The final active administrator cannot be demoted or deactivated.')
    fireEvent.change(within(table).getByLabelText('Role for maria@example.com'), { target: { value: 'CUSTOMER' } })
    fireEvent.click(within(table).getAllByRole('button', { name: 'Update role' })[1])
    expect(await screen.findAllByText('Reassign the agent first.')).not.toHaveLength(0)
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
