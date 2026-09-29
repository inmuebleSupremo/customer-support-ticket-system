package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.domain.TicketStatus;

public class InvalidTicketStatusTransitionException extends RuntimeException {
    public InvalidTicketStatusTransitionException(TicketStatus from, TicketStatus to) {
        super("Ticket cannot transition from " + from + " to " + to + ".");
    }
}
