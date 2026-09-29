package com.resolvedesk.users.api;

import com.resolvedesk.users.domain.UserRole;

import java.time.Instant;

public record CurrentUserResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        UserRole role,
        boolean active,
        Instant createdAt
) {
}
