package com.resolvedesk.tickets.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public record ChangeTicketTeamRequest(@Positive Long teamId, @NotNull @PositiveOrZero Long version) {
}
