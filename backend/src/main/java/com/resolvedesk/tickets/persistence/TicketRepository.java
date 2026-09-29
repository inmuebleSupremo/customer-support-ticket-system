package com.resolvedesk.tickets.persistence;

import com.resolvedesk.tickets.domain.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    Page<Ticket> findByCustomerId(Long customerId, Pageable pageable);

    Optional<Ticket> findByIdAndCustomerId(Long id, Long customerId);
}
