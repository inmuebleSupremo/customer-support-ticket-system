package com.resolvedesk.teams.api;

import jakarta.validation.constraints.NotNull;

public record ChangeTeamActiveStateRequest(@NotNull Boolean active) {
}
