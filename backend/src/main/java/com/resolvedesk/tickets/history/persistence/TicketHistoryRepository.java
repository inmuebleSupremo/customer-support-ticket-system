package com.resolvedesk.tickets.history.persistence;

import com.resolvedesk.tickets.history.domain.TicketHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketHistoryRepository extends JpaRepository<TicketHistory, Long> {
}
