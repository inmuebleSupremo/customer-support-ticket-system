package com.resolvedesk.tickets.application;

import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.api.TicketDetailResponse;
import com.resolvedesk.tickets.api.TicketSummaryResponse;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.tickets.persistence.TicketSpecifications;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import com.resolvedesk.teams.persistence.TeamRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class CustomerTicketWorkspaceService {

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository ticketHistoryRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

    public CustomerTicketWorkspaceService(
            TicketRepository ticketRepository,
            TicketHistoryRepository ticketHistoryRepository,
            UserRepository userRepository,
            TeamRepository teamRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketHistoryRepository = ticketHistoryRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
    }

    public PageResponse<TicketSummaryResponse> listTickets(User actor, TicketQueueQuery query) {
        return PageResponse.from(
                ticketRepository.findAll(TicketSpecifications.queueFor(actor, query), PageRequest.of(query.page(), query.size(), query.sort())),
                TicketResponseMapper::toSummary
        );
    }

    public TicketDetailResponse getTicket(User actor, long ticketId) {
        return TicketResponseMapper.toDetail(findAccessibleTicket(actor, ticketId));
    }

    public List<TicketHistoryResponse> getHistory(User actor, long ticketId) {
        findAccessibleTicket(actor, ticketId);
        return ticketHistoryRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(history -> TicketHistoryResponseMapper.toResponse(history, this::agentDisplayName, this::teamDisplayName))
                .toList();
    }

    private String agentDisplayName(Long userId) {
        return userRepository.findById(userId)
                .map(user -> user.getFirstName() + " " + user.getLastName())
                .orElse("Unknown agent");
    }

    private String teamDisplayName(Long teamId) {
        return teamRepository.findById(teamId).map(team -> team.getName()).orElse("Unknown team");
    }

    private Ticket findAccessibleTicket(User actor, long ticketId) {
        if (actor.getRole() == UserRole.CUSTOMER) {
            return ticketRepository.findByIdAndCustomerId(ticketId, actor.getId())
                    .orElseThrow(TicketNotFoundException::new);
        }
        return ticketRepository.findById(ticketId).orElseThrow(TicketNotFoundException::new);
    }
}
