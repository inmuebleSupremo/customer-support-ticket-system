package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.api.CreateTicketRequest;
import com.resolvedesk.tickets.api.TicketDetailResponse;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.domain.TicketHistory;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketCreationService {

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository ticketHistoryRepository;

    public TicketCreationService(TicketRepository ticketRepository, TicketHistoryRepository ticketHistoryRepository) {
        this.ticketRepository = ticketRepository;
        this.ticketHistoryRepository = ticketHistoryRepository;
    }

    @Transactional
    public TicketDetailResponse create(User customer, CreateTicketRequest request) {
        Ticket ticket = Ticket.create(customer, request.title().trim(), request.description().trim());
        Ticket savedTicket = ticketRepository.saveAndFlush(ticket);
        ticketHistoryRepository.save(TicketHistory.ticketCreated(savedTicket, customer));
        return TicketResponseMapper.toDetail(savedTicket);
    }
}
