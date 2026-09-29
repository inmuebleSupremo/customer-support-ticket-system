package com.resolvedesk.tickets.persistence;

import com.resolvedesk.tickets.domain.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
}
