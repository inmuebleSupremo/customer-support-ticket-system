package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.api.CreateTicketRequest;
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
}
