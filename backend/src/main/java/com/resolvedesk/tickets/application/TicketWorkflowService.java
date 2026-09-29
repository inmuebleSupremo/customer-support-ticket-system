package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.api.ChangeTicketAssigneeRequest;
import com.resolvedesk.tickets.api.ChangeTicketStatusRequest;
import com.resolvedesk.tickets.api.ChangeTicketPriorityRequest;
import com.resolvedesk.tickets.api.TicketAssignmentMutationResponse;
import com.resolvedesk.tickets.api.TicketStatusMutationResponse;
import com.resolvedesk.tickets.api.TicketPriorityMutationResponse;
import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.domain.TicketStatus;
import com.resolvedesk.tickets.history.domain.TicketHistory;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

@Service
public class TicketWorkflowService {

    private static final Map<TicketStatus, Set<TicketStatus>> STAFF_TRANSITIONS = Map.of(
            TicketStatus.OPEN, Set.of(TicketStatus.IN_PROGRESS),
            TicketStatus.IN_PROGRESS, Set.of(TicketStatus.OPEN, TicketStatus.RESOLVED),
            TicketStatus.RESOLVED, Set.of(TicketStatus.IN_PROGRESS, TicketStatus.CLOSED)
    );

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository ticketHistoryRepository;
    private final UserRepository userRepository;

    public TicketWorkflowService(
            TicketRepository ticketRepository,
            TicketHistoryRepository ticketHistoryRepository,
            UserRepository userRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketHistoryRepository = ticketHistoryRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TicketAssignmentMutationResponse changeAssignee(User actor, long ticketId, ChangeTicketAssigneeRequest request) {
        Ticket ticket = findAccessibleTicket(actor, ticketId);
        requireNotClosed(ticket);
        requireCurrentVersion(ticket, request.version());

        User assignedAgent = request.agentId() == null ? null : userRepository.findById(request.agentId())
                .filter(user -> user.isActive() && user.getRole() == UserRole.AGENT)
                .orElseThrow(InvalidAssigneeException::new);
        Long oldAgentId = ticket.getAssignedAgent() == null ? null : ticket.getAssignedAgent().getId();
        if (assignedAgent == null) {
            ticket.unassign();
        } else {
            ticket.assignTo(assignedAgent);
        }
        ticketRepository.saveAndFlush(ticket);
        ticketHistoryRepository.save(TicketHistory.assignmentChanged(ticket, actor, oldAgentId,
                assignedAgent == null ? null : assignedAgent.getId()));
        return TicketResponseMapper.toAssignmentMutation(ticket);
    }

    @Transactional
    public TicketStatusMutationResponse changeStatus(User actor, long ticketId, ChangeTicketStatusRequest request) {
        Ticket ticket = findAccessibleTicket(actor, ticketId);
        requireNotClosed(ticket);
        requireCurrentVersion(ticket, request.version());
        if (actor.getRole() == UserRole.CUSTOMER) {
            if (ticket.getStatus() != TicketStatus.RESOLVED || request.status() != TicketStatus.IN_PROGRESS) {
                throw new AccessDeniedException("Customers may only reopen their own resolved tickets.");
            }
        } else if (!STAFF_TRANSITIONS.getOrDefault(ticket.getStatus(), Set.of()).contains(request.status())) {
            throw new InvalidTicketStatusTransitionException(ticket.getStatus(), request.status());
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.changeStatus(request.status());
        ticketRepository.saveAndFlush(ticket);
        ticketHistoryRepository.save(TicketHistory.statusChanged(ticket, actor, oldStatus.name(), request.status().name()));
        return TicketResponseMapper.toStatusMutation(ticket);
    }

    @Transactional
    public TicketPriorityMutationResponse changePriority(User actor, long ticketId, ChangeTicketPriorityRequest request) {
        if (actor.getRole() == UserRole.CUSTOMER) {
            throw new AccessDeniedException("Customers cannot change ticket priority.");
        }
        Ticket ticket = findAccessibleTicket(actor, ticketId);
        requireNotClosed(ticket);
        requireCurrentVersion(ticket, request.version());
        TicketPriority oldPriority = ticket.getPriority();
        ticket.changePriority(request.priority());
        ticketRepository.saveAndFlush(ticket);
        ticketHistoryRepository.save(TicketHistory.priorityChanged(ticket, actor, oldPriority.name(), request.priority().name()));
        return TicketResponseMapper.toPriorityMutation(ticket);
    }

    private Ticket findAccessibleTicket(User actor, long ticketId) {
        if (actor.getRole() == UserRole.CUSTOMER) {
            return ticketRepository.findByIdAndCustomerId(ticketId, actor.getId())
                    .orElseThrow(TicketNotFoundException::new);
        }
        return ticketRepository.findById(ticketId).orElseThrow(TicketNotFoundException::new);
    }

    private void requireNotClosed(Ticket ticket) {
        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new TicketClosedException();
        }
    }

    private void requireCurrentVersion(Ticket ticket, Long requestedVersion) {
        if (!ticket.getVersion().equals(requestedVersion)) {
            throw new StaleTicketException();
        }
    }
}
