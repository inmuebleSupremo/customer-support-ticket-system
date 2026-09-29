package com.resolvedesk.tickets.history.api;

import com.resolvedesk.tickets.api.UserSummaryResponse;
import com.resolvedesk.tickets.history.domain.TicketEventType;

import java.time.Instant;

public record TicketHistoryResponse(
        Long id,
        TicketEventType eventType,
        String fieldName,
        String oldValue,
        String newValue,
        String oldDisplayValue,
        String newDisplayValue,
        UserSummaryResponse actor,
        Instant createdAt
) {
}
