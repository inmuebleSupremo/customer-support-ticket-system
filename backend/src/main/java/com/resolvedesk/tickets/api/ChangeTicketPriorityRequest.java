package com.resolvedesk.tickets.api;

import com.resolvedesk.tickets.domain.TicketPriority;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ChangeTicketPriorityRequest(@NotNull TicketPriority priority, @NotNull @PositiveOrZero Long version) {
}
