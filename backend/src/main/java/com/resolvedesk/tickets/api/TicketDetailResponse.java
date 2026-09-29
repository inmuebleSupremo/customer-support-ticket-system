package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.domain.TicketStatus;

import java.time.Instant;

public record TicketDetailResponse(
        Long id,
        String reference,
        String title,
        String description,
        TicketStatus status,
        TicketPriority priority,
        UserSummaryResponse customer,
        UserSummaryResponse assignedAgent,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt,
        Instant closedAt,
        Long version
) {
}
