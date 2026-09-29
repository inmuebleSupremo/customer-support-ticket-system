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

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  return apiRequest('/tickets', { method: 'POST', body: JSON.stringify(input) }, true)
}
