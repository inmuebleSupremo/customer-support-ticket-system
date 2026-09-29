import { apiRequest } from './client'

export interface CreateTicketInput {
  title: string
  description: string
}

export interface TicketUserSummary {
  id: number
  displayName: string
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

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  return apiRequest('/tickets', { method: 'POST', body: JSON.stringify(input) }, true)
}

export function listTickets(): Promise<PageResponse<TicketSummary>> {
  return apiRequest('/tickets')
}

export function getTicket(id: string): Promise<TicketDetail> {
  return apiRequest(`/tickets/${id}`)
}

export function getTicketHistory(id: string): Promise<TicketHistoryEntry[]> {
  return apiRequest(`/tickets/${id}/history`)
}
