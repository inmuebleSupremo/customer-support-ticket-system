package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketPriority;

import java.time.Instant;

public record TicketPriorityMutationResponse(
        Long id,
        String reference,
        TicketPriority priority,
        Instant updatedAt,
        Long version
) {
}
