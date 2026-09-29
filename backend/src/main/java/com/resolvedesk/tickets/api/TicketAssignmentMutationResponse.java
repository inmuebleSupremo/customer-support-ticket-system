package com.resolvedesk.tickets.api;

import java.time.Instant;

public record TicketAssignmentMutationResponse(
        Long id,
        String reference,
        UserSummaryResponse assignedAgent,
        Instant updatedAt,
        Long version
) {
}
