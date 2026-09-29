package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketStatus;

import java.time.Instant;

public record TicketStatusMutationResponse(
        Long id,
        String reference,
        TicketStatus status,
        Instant resolvedAt,
        Instant closedAt,
        Instant updatedAt,
        Long version
) {
}
