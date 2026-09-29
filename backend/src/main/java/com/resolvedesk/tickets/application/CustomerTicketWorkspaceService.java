package com.resolvedesk.tickets.application;

import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.api.TicketDetailResponse;
import com.resolvedesk.tickets.api.TicketSummaryResponse;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class CustomerTicketWorkspaceService {

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "updatedAt");

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository ticketHistoryRepository;

    public CustomerTicketWorkspaceService(TicketRepository ticketRepository, TicketHistoryRepository ticketHistoryRepository) {
        this.ticketRepository = ticketRepository;
        this.ticketHistoryRepository = ticketHistoryRepository;
    }

    public PageResponse<TicketSummaryResponse> listTickets(User customer, int page, int size) {
        return PageResponse.from(
                ticketRepository.findByCustomerId(customer.getId(), PageRequest.of(page, size, DEFAULT_SORT)),
                TicketResponseMapper::toSummary
        );
    }

    public TicketDetailResponse getTicket(User customer, long ticketId) {
        return TicketResponseMapper.toDetail(findOwnedTicket(customer, ticketId));
    }

    public List<TicketHistoryResponse> getHistory(User customer, long ticketId) {
        findOwnedTicket(customer, ticketId);
        return ticketHistoryRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(TicketHistoryResponseMapper::toResponse)
                .toList();
    }

    private Ticket findOwnedTicket(User customer, long ticketId) {
        return ticketRepository.findByIdAndCustomerId(ticketId, customer.getId())
                .orElseThrow(TicketNotFoundException::new);
    }
}
