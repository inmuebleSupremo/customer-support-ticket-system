package com.resolvedesk.users.api;

import com.resolvedesk.users.domain.UserRole;

public record UserMutationResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        UserRole role,
        boolean active
) {
}
