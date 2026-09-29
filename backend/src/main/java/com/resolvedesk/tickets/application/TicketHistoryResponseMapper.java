package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import com.resolvedesk.tickets.history.domain.TicketHistory;

final class TicketHistoryResponseMapper {
    private TicketHistoryResponseMapper() {
    }

    static TicketHistoryResponse toResponse(TicketHistory history) {
        return new TicketHistoryResponse(
                history.getId(),
                history.getEventType(),
                history.getFieldName(),
                history.getOldValue(),
                history.getNewValue(),
                displayValue(history.getOldValue()),
                displayValue(history.getNewValue()),
                TicketResponseMapper.toUserSummary(history.getActor()),
                history.getCreatedAt()
        );
    }

    private static String displayValue(String value) {
        return value;
    }
}
