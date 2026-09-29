package com.resolvedesk.users.api;

import com.resolvedesk.users.domain.UserRole;
import jakarta.validation.constraints.NotNull;

public record ChangeUserRoleRequest(@NotNull(message = "Role is required.") UserRole role) {
}
