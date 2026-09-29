import { apiRequest } from './client'

export interface CreateTicketInput {
  title: string
  description: string
}

export interface TicketUserSummary {
  id: number
  displayName: string
}

export interface AgentSummary extends TicketUserSummary {
  email: string
}

export interface TicketDetail {
  id: number
  reference: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  customer: TicketUserSummary
  assignedAgent: TicketUserSummary | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  version: number
}

export interface TicketSummary {
  id: number
  reference: string
  title: string
  status: TicketDetail['status']
  priority: TicketDetail['priority']
  customer: TicketUserSummary
  assignedAgent: TicketUserSummary | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface TicketHistoryEntry {
  id: number
  eventType: 'TICKET_CREATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'ASSIGNMENT_CHANGED'
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  oldDisplayValue: string | null
  newDisplayValue: string | null
  actor: TicketUserSummary
  createdAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface TicketListQuery {
  status?: TicketDetail['status']
  priority?: TicketDetail['priority']
  assignedAgentId?: string
  unassigned?: boolean
  search?: string
  page?: number
  size?: number
  sort?: string
}

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  return apiRequest('/tickets', { method: 'POST', body: JSON.stringify(input) }, true)
}

export function listTickets(query: TicketListQuery = {}): Promise<PageResponse<TicketSummary>> {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.priority) params.set('priority', query.priority)
  if (query.assignedAgentId) params.set('assignedAgentId', query.assignedAgentId)
  if (query.unassigned) params.set('unassigned', 'true')
  if (query.search) params.set('search', query.search)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.size !== undefined) params.set('size', String(query.size))
  if (query.sort) params.set('sort', query.sort)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiRequest(`/tickets${suffix}`)
}

export function getTicket(id: string): Promise<TicketDetail> {
  return apiRequest(`/tickets/${id}`)
}

export function getTicketHistory(id: string): Promise<TicketHistoryEntry[]> {
  return apiRequest(`/tickets/${id}/history`)
}

export function getAgents(): Promise<AgentSummary[]> {
  return apiRequest('/agents')
}

export function changeTicketAssignee(id: number, agentId: number | null, version: number) {
  return apiRequest(`/tickets/${id}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ agentId, version })
  }, true)
}

export function changeTicketStatus(id: number, status: TicketDetail['status'], version: number) {
  return apiRequest(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, version })
  }, true)
}
