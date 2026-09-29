package com.resolvedesk.tickets.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CustomerTicketWorkspaceIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManager entityManager;

    @AfterEach
    void cleanDatabase() {
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void customerSeesOnlyOwnTicketsWithTicketSummaryShape() throws Exception {
        User customer = persistedUser("customer@example.com");
        User anotherCustomer = persistedUser("another@example.com");
        Ticket owned = persistedTicket(customer, "My password reset issue");
        persistedTicket(anotherCustomer, "Another customer's issue");

        mockMvc.perform(get("/api/v1/tickets").with(customerAuthentication(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(owned.getId()))
                .andExpect(jsonPath("$.content[0].reference").value("SUP-" + owned.getId()))
                .andExpect(jsonPath("$.content[0].title").value("My password reset issue"))
                .andExpect(jsonPath("$.content[0].status").value("OPEN"))
                .andExpect(jsonPath("$.content[0].priority").value("MEDIUM"))
                .andExpect(jsonPath("$.content[0].customer.displayName").value("Test Customer"))
                .andExpect(jsonPath("$.content[0].assignedAgent").value(nullValue()))
                .andExpect(jsonPath("$.content[0].description").doesNotExist());
    }

    @Test
    void customerTicketWorkspaceUsesDocumentedDefaultPaginationAndUpdatedAtDescendingSort() throws Exception {
        User customer = persistedUser("customer@example.com");
        for (int index = 0; index < 21; index++) {
            Ticket ticket = persistedTicket(customer, "Ticket number " + index);
            jdbcTemplate.update("UPDATE tickets SET updated_at = ? WHERE id = ?",
                    Timestamp.from(Instant.parse("2026-09-29T10:00:00Z").plusSeconds(index)), ticket.getId());
        }
        entityManager.clear();

        mockMvc.perform(get("/api/v1/tickets").with(customerAuthentication(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(21))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(false))
                .andExpect(jsonPath("$.content.length()").value(20))
                .andExpect(jsonPath("$.content[0].title").value("Ticket number 20"));
    }

    @Test
    void customerCanRetrieveOwnTicketDetailAndHistory() throws Exception {
        User customer = persistedUser("customer@example.com");
        Ticket ticket = persistedTicket(customer, "Unable to reset my password");

        mockMvc.perform(get("/api/v1/tickets/{id}", ticket.getId()).with(customerAuthentication(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ticket.getId()))
                .andExpect(jsonPath("$.reference").value("SUP-" + ticket.getId()))
                .andExpect(jsonPath("$.description").value("A detailed description of the support issue."))
                .andExpect(jsonPath("$.customer.displayName").value("Test Customer"))
                .andExpect(jsonPath("$.assignedAgent").value(nullValue()))
                .andExpect(jsonPath("$.resolvedAt").value(nullValue()))
                .andExpect(jsonPath("$.closedAt").value(nullValue()));

        mockMvc.perform(get("/api/v1/tickets/{id}/history", ticket.getId()).with(customerAuthentication(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].eventType").value("TICKET_CREATED"))
                .andExpect(jsonPath("$[0].fieldName").value(nullValue()))
                .andExpect(jsonPath("$[0].oldValue").value(nullValue()))
                .andExpect(jsonPath("$[0].newValue").value(nullValue()))
                .andExpect(jsonPath("$[0].oldDisplayValue").value(nullValue()))
                .andExpect(jsonPath("$[0].newDisplayValue").value(nullValue()))
                .andExpect(jsonPath("$[0].actor.id").value(customer.getId()))
                .andExpect(jsonPath("$[0].actor.displayName").value("Test Customer"));
    }

    @Test
    void crossCustomerTicketAndHistoryAccessAreConcealedAsNotFound() throws Exception {
        User owner = persistedUser("owner@example.com");
        User otherCustomer = persistedUser("other@example.com");
        Ticket ticket = persistedTicket(owner, "Private customer issue");

        mockMvc.perform(get("/api/v1/tickets/{id}", ticket.getId()).with(customerAuthentication(otherCustomer)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", ticket.getId()).with(customerAuthentication(otherCustomer)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void ticketWorkspaceRequiresAnAuthenticatedCustomer() throws Exception {
        User agent = userRepository.saveAndFlush(User.create("agent@example.com", "hash", "Test", "Agent", UserRole.AGENT));

        mockMvc.perform(get("/api/v1/tickets")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/tickets").with(customerAuthentication(agent))).andExpect(status().isOk());
    }

    private Ticket persistedTicket(User customer, String title) {
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, title, "A detailed description of the support issue."));
        ticketHistoryRepository.saveAndFlush(TicketHistory.ticketCreated(ticket, customer));
        return ticket;
    }

    private User persistedUser(String email) {
        return userRepository.saveAndFlush(User.create(email, "hash", "Test", "Customer", UserRole.CUSTOMER));
    }

    private RequestPostProcessor customerAuthentication(User user) {
        return SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user));
    }
}
