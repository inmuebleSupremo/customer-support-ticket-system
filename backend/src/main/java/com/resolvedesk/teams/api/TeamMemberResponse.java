package com.resolvedesk.teams.api;

public record TeamMemberResponse(Long id, String displayName, String email, boolean active) {
}
