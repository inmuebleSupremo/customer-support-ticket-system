package com.resolvedesk.teams.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeTeamNameRequest(
        @NotBlank(message = "Team name is required.")
        @Size(max = 120, message = "Team name must not exceed 120 characters.")
        String name
) {
}
