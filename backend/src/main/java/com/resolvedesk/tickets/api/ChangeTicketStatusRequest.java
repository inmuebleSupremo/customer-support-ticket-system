package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ChangeTicketStatusRequest(@NotNull TicketStatus status, @NotNull @PositiveOrZero Long version) {
}
