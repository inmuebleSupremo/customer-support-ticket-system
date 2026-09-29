package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.domain.TicketStatus;

import java.time.Instant;

public record TicketSummaryResponse(
        Long id,
        String reference,
        String title,
        TicketStatus status,
        TicketPriority priority,
        UserSummaryResponse customer,
        UserSummaryResponse assignedAgent,
        Instant createdAt,
        Instant updatedAt,
        Long version
) {
}
