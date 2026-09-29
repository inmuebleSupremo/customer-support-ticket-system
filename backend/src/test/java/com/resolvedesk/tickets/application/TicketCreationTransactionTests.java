package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.api.CreateTicketRequest;
import com.resolvedesk.tickets.api.ChangeTicketStatusRequest;
import com.resolvedesk.tickets.api.ChangeTicketAssigneeRequest;
import com.resolvedesk.tickets.api.ChangeTicketPriorityRequest;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willThrow;

@SpringBootTest
@ActiveProfiles("test")
class TicketCreationTransactionTests {

    @Autowired private TicketCreationService ticketCreationService;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketWorkflowService ticketWorkflowService;
    @MockBean private TicketHistoryRepository ticketHistoryRepository;

    @AfterEach
    void cleanDatabase() {
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void rollsBackTicketCreationWhenTheRequiredHistoryWriteFails() {
        User customer = userRepository.saveAndFlush(User.create("customer@example.com", "hash", "Test", "Customer", UserRole.CUSTOMER));
        willThrow(new IllegalStateException("History persistence failed")).given(ticketHistoryRepository).save(any());

        assertThatThrownBy(() -> ticketCreationService.create(customer,
                new CreateTicketRequest("A valid title", "A valid ticket description.")))
                .isInstanceOf(IllegalStateException.class);

        assertThat(ticketRepository.count()).isZero();
    }

    @Test
    void rollsBackStatusChangeWhenTheRequiredHistoryWriteFails() {
        User customer = userRepository.saveAndFlush(User.create("customer@example.com", "hash", "Test", "Customer", UserRole.CUSTOMER));
        User agent = userRepository.saveAndFlush(User.create("agent@example.com", "hash", "Test", "Agent", UserRole.AGENT));
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A valid title", "A valid ticket description."));
        willThrow(new IllegalStateException("History persistence failed")).given(ticketHistoryRepository).save(any());

        assertThatThrownBy(() -> ticketWorkflowService.changeStatus(agent, ticket.getId(),
                new ChangeTicketStatusRequest(com.resolvedesk.tickets.domain.TicketStatus.IN_PROGRESS, 0L)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getStatus().name()).isEqualTo("OPEN");
    }

    @Test
    void rollsBackAssignmentChangeWhenTheRequiredHistoryWriteFails() {
        User customer = userRepository.saveAndFlush(User.create("customer@example.com", "hash", "Test", "Customer", UserRole.CUSTOMER));
        User agent = userRepository.saveAndFlush(User.create("agent@example.com", "hash", "Test", "Agent", UserRole.AGENT));
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A valid title", "A valid ticket description."));
        willThrow(new IllegalStateException("History persistence failed")).given(ticketHistoryRepository).save(any());

        assertThatThrownBy(() -> ticketWorkflowService.changeAssignee(agent, ticket.getId(),
                new ChangeTicketAssigneeRequest(agent.getId(), 0L)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getAssignedAgent()).isNull();
    }

    @Test
    void rollsBackPriorityChangeWhenTheRequiredHistoryWriteFails() {
        User customer = userRepository.saveAndFlush(User.create("customer@example.com", "hash", "Test", "Customer", UserRole.CUSTOMER));
        User agent = userRepository.saveAndFlush(User.create("agent@example.com", "hash", "Test", "Agent", UserRole.AGENT));
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A valid title", "A valid ticket description."));
        willThrow(new IllegalStateException("History persistence failed")).given(ticketHistoryRepository).save(any());

        assertThatThrownBy(() -> ticketWorkflowService.changePriority(agent, ticket.getId(),
                new ChangeTicketPriorityRequest(TicketPriority.HIGH, 0L)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getPriority()).isEqualTo(TicketPriority.MEDIUM);
    }
}
