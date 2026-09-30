package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.domain.TicketStatus;
import com.resolvedesk.teams.api.TeamSummaryResponse;

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
        TeamSummaryResponse assignedTeam,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt,
        Instant closedAt,
        Long version
) {
}
