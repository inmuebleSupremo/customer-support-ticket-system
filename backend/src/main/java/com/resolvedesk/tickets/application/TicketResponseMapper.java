package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.api.TicketDetailResponse;
import com.resolvedesk.tickets.api.TicketSummaryResponse;
import com.resolvedesk.tickets.api.UserSummaryResponse;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.users.domain.User;

public final class TicketResponseMapper {
    private TicketResponseMapper() {
    }

    public static TicketDetailResponse toDetail(Ticket ticket) {
        return new TicketDetailResponse(
                ticket.getId(),
                TicketReference.format(ticket.getId()),
                ticket.getTitle(),
                ticket.getDescription(),
                ticket.getStatus(),
                ticket.getPriority(),
                toUserSummary(ticket.getCustomer()),
                ticket.getAssignedAgent() == null ? null : toUserSummary(ticket.getAssignedAgent()),
                ticket.getCreatedAt(),
                ticket.getUpdatedAt(),
                ticket.getResolvedAt(),
                ticket.getClosedAt(),
                ticket.getVersion()
        );
    }

    public static TicketSummaryResponse toSummary(Ticket ticket) {
        return new TicketSummaryResponse(
                ticket.getId(),
                TicketReference.format(ticket.getId()),
                ticket.getTitle(),
                ticket.getStatus(),
                ticket.getPriority(),
                toUserSummary(ticket.getCustomer()),
                ticket.getAssignedAgent() == null ? null : toUserSummary(ticket.getAssignedAgent()),
                ticket.getCreatedAt(),
                ticket.getUpdatedAt(),
                ticket.getVersion()
        );
    }

    public static UserSummaryResponse toUserSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getFirstName() + " " + user.getLastName());
    }
}
