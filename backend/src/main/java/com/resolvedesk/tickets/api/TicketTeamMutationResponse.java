package com.resolvedesk.tickets.api;

import com.resolvedesk.teams.api.TeamSummaryResponse;

import java.time.Instant;

public record TicketTeamMutationResponse(
        Long id,
        String reference,
        TeamSummaryResponse assignedTeam,
        UserSummaryResponse assignedAgent,
        Instant updatedAt,
        Long version
) {
}
