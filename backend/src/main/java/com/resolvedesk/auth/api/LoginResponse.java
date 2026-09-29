package com.resolvedesk.auth.api;

import com.resolvedesk.users.domain.UserRole;

public record LoginResponse(LoginUserResponse user) {
    public record LoginUserResponse(
            Long id,
            String firstName,
            String lastName,
            String email,
            UserRole role,
            boolean active
    ) {
    }
}
