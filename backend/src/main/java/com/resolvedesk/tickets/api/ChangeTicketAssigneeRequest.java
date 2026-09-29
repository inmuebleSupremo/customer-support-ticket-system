package com.resolvedesk.tickets.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ChangeTicketAssigneeRequest(Long agentId, @NotNull @PositiveOrZero Long version) {
}
