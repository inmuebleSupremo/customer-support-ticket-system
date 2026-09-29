package com.resolvedesk.tickets.comments.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.tickets.comments.domain.Comment;
import com.resolvedesk.tickets.comments.persistence.CommentRepository;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.domain.TicketHistory;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TicketCommentIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;
    @Autowired private CommentRepository commentRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManager entityManager;

    @AfterEach
    void cleanDatabase() {
        commentRepository.deleteAll();
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void customerAgentAndAdministratorCanCommentOnAnAccessibleActiveTicketWithoutCreatingHistory() throws Exception {
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        User agent = persistedUser("agent@example.com", "Test", "Agent", UserRole.AGENT);
        User administrator = persistedUser("admin@example.com", "Test", "Administrator", UserRole.ADMIN);
        Ticket ticket = persistedTicket(customer);
        Instant originalUpdatedAt = ticket.getUpdatedAt();

        addComment(customer, ticket, "Customer follow-up").andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.id").value(customer.getId()))
                .andExpect(jsonPath("$.author.role").value("CUSTOMER"));
        addComment(agent, ticket, "Agent response").andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.id").value(agent.getId()))
                .andExpect(jsonPath("$.author.role").value("AGENT"));
        addComment(administrator, ticket, "Administrator response").andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.id").value(administrator.getId()))
                .andExpect(jsonPath("$.author.role").value("ADMIN"));

        mockMvc.perform(get("/api/v1/tickets/{id}/comments", ticket.getId()).with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].content").value("Customer follow-up"))
                .andExpect(jsonPath("$.content[1].author.displayName").value("Test Agent"))
                .andExpect(jsonPath("$.content[2].author.role").value("ADMIN"));
        entityManager.clear();
        Ticket changedTicket = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(changedTicket.getUpdatedAt()).isAfter(originalUpdatedAt);
        assertThat(changedTicket.getVersion()).isEqualTo(3);
        assertThat(ticketHistoryRepository.count()).isEqualTo(1);
    }

    @Test
    void customerCommentAccessIsConcealedForAnotherCustomersTicket() throws Exception {
        User owner = persistedUser("owner@example.com", "Owner", "Customer", UserRole.CUSTOMER);
        User otherCustomer = persistedUser("other@example.com", "Other", "Customer", UserRole.CUSTOMER);
        Ticket ticket = persistedTicket(owner);

        mockMvc.perform(get("/api/v1/tickets/{id}/comments", ticket.getId()).with(authentication(otherCustomer)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        addComment(otherCustomer, ticket, "This must not be accepted")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void commentsValidateMeaningfulContentAndRejectClosedTickets() throws Exception {
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        Ticket ticket = persistedTicket(customer);

        addComment(customer, ticket, "   ").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.content").exists());
        addComment(customer, ticket, "x".repeat(3001)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.content").exists());
        jdbcTemplate.update("UPDATE tickets SET status = 'CLOSED' WHERE id = ?", ticket.getId());
        entityManager.clear();
        addComment(customer, ticket, "This ticket is now closed").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TICKET_CLOSED"))
                .andExpect(jsonPath("$.detail").value("Comments cannot be added to a closed ticket."));
    }

    @Test
    void commentsAreChronologicalAndPaginatedServerSide() throws Exception {
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        Ticket ticket = persistedTicket(customer);
        Comment first = commentRepository.saveAndFlush(Comment.create(ticket, customer, "First"));
        Comment second = commentRepository.saveAndFlush(Comment.create(ticket, customer, "Second"));
        Comment third = commentRepository.saveAndFlush(Comment.create(ticket, customer, "Third"));
        jdbcTemplate.update("UPDATE comments SET created_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-09-29T10:00:00Z")), first.getId());
        jdbcTemplate.update("UPDATE comments SET created_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-09-29T10:01:00Z")), second.getId());
        jdbcTemplate.update("UPDATE comments SET created_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-09-29T10:02:00Z")), third.getId());
        entityManager.clear();

        mockMvc.perform(get("/api/v1/tickets/{id}/comments?page=0&size=2", ticket.getId()).with(authentication(customer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].content").value("First"))
                .andExpect(jsonPath("$.content[1].content").value("Second"))
                .andExpect(jsonPath("$.first").value(true)).andExpect(jsonPath("$.last").value(false));
        mockMvc.perform(get("/api/v1/tickets/{id}/comments?page=1&size=2", ticket.getId()).with(authentication(customer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].content").value("Third"));
        mockMvc.perform(get("/api/v1/tickets/{id}/comments", ticket.getId())).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions addComment(User actor, Ticket ticket, String content) throws Exception {
        return mockMvc.perform(post("/api/v1/tickets/{id}/comments", ticket.getId()).with(authentication(actor)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + content + "\"}"));
    }

    private Ticket persistedTicket(User customer) {
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A valid support issue", "A detailed description of the support issue."));
        ticketHistoryRepository.saveAndFlush(TicketHistory.ticketCreated(ticket, customer));
        return ticket;
    }

    private User persistedUser(String email, String firstName, String lastName, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, "hash", firstName, lastName, role));
    }

    private RequestPostProcessor authentication(User user) {
        return user(new AuthenticatedUser(user));
    }
}
