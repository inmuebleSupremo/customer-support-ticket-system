package com.resolvedesk.teams.api;

import java.time.Instant;
import java.util.List;

public record TeamDetailResponse(
        Long id,
        String name,
        boolean active,
        List<TeamMemberResponse> members,
        Instant createdAt,
        Instant updatedAt
) {
}
