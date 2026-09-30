package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import com.resolvedesk.tickets.history.domain.TicketHistory;
import com.resolvedesk.tickets.history.domain.TicketEventType;

import java.util.function.Function;
import java.util.Arrays;
import java.util.stream.Collectors;

final class TicketHistoryResponseMapper {
    private TicketHistoryResponseMapper() {
    }

    static TicketHistoryResponse toResponse(TicketHistory history, Function<Long, String> agentDisplayName, Function<Long, String> teamDisplayName) {
        return new TicketHistoryResponse(
                history.getId(),
                history.getEventType(),
                history.getFieldName(),
                history.getOldValue(),
                history.getNewValue(),
                displayValue(history, history.getOldValue(), agentDisplayName, teamDisplayName),
                displayValue(history, history.getNewValue(), agentDisplayName, teamDisplayName),
                TicketResponseMapper.toUserSummary(history.getActor()),
                history.getCreatedAt()
        );
    }

    private static String displayValue(TicketHistory history, String value, Function<Long, String> agentDisplayName, Function<Long, String> teamDisplayName) {
        if (history.getEventType() == TicketEventType.TICKET_CREATED) {
            return null;
        }
        if (history.getEventType() == TicketEventType.ASSIGNMENT_CHANGED) {
            return value == null ? "Unassigned" : agentDisplayName.apply(Long.valueOf(value));
        }
        if (history.getEventType() == TicketEventType.TEAM_CHANGED) {
            return value == null ? "Unassigned" : teamDisplayName.apply(Long.valueOf(value));
        }
        return value == null ? null : toDisplayCase(value);
    }

    private static String toDisplayCase(String value) {
        return Arrays.stream(value.toLowerCase().split("_"))
                .map(word -> Character.toUpperCase(word.charAt(0)) + word.substring(1))
                .collect(Collectors.joining(" "));
    }
}
