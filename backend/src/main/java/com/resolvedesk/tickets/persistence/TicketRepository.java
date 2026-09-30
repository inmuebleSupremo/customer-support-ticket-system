package com.resolvedesk.tickets.persistence;

import com.resolvedesk.tickets.domain.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.Collection;
import com.resolvedesk.tickets.domain.TicketStatus;

public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {
    Page<Ticket> findByCustomerId(Long customerId, Pageable pageable);

    Optional<Ticket> findByIdAndCustomerId(Long id, Long customerId);

    boolean existsByAssignedAgentIdAndStatusIn(Long assignedAgentId, Collection<TicketStatus> statuses);

    boolean existsByAssignedTeamIdAndStatusIn(Long assignedTeamId, Collection<TicketStatus> statuses);

    boolean existsByAssignedAgentIdAndAssignedTeamIdAndStatusIn(
            Long assignedAgentId, Long assignedTeamId, Collection<TicketStatus> statuses
    );
}
