package com.resolvedesk.users.api;

import jakarta.validation.constraints.NotNull;

public record ChangeUserActiveStateRequest(@NotNull(message = "Active state is required.") Boolean active) {
}
