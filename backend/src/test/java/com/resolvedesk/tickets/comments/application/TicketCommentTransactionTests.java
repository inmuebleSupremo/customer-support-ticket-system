package com.resolvedesk.tickets.comments.application;

import com.resolvedesk.tickets.comments.api.CreateCommentRequest;
import com.resolvedesk.tickets.comments.persistence.CommentRepository;
import com.resolvedesk.tickets.domain.Ticket;
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
class TicketCommentTransactionTests {

    @Autowired private TicketCommentService ticketCommentService;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private UserRepository userRepository;
    @MockBean private CommentRepository commentRepository;

    @AfterEach
    void cleanDatabase() {
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void rollsBackTheTicketActivityUpdateWhenCommentPersistenceFails() {
        User customer = userRepository.saveAndFlush(User.create("customer@example.com", "hash", "Test", "Customer", UserRole.CUSTOMER));
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A valid title", "A valid ticket description."));
        willThrow(new IllegalStateException("Comment persistence failed")).given(commentRepository).save(any());

        assertThatThrownBy(() -> ticketCommentService.createComment(customer, ticket.getId(), new CreateCommentRequest("A reply")))
                .isInstanceOf(IllegalStateException.class);

        Ticket unchangedTicket = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(unchangedTicket.getVersion()).isZero();
    }
}
