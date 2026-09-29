package com.resolvedesk.users.application;

import com.resolvedesk.users.api.CurrentUserResponse;
import com.resolvedesk.users.domain.User;

public final class UserResponseMapper {

    private UserResponseMapper() {
    }

    public static CurrentUserResponse toCurrentUser(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
