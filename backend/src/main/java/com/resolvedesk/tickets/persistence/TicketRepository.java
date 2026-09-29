package com.resolvedesk.tickets.persistence;

import com.resolvedesk.tickets.domain.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {
    Page<Ticket> findByCustomerId(Long customerId, Pageable pageable);

    Optional<Ticket> findByIdAndCustomerId(Long id, Long customerId);
}
