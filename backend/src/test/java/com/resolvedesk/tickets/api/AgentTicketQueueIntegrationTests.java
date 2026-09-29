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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AgentTicketQueueIntegrationTests {

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
    void agentsAndAdministratorsSeeTheFullQueueAndCanReadAnyTicketAndHistory() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User firstCustomer = persistedUser("first@example.com", UserRole.CUSTOMER);
        User secondCustomer = persistedUser("second@example.com", UserRole.CUSTOMER);
        Ticket first = persistedTicket(firstCustomer, "First customer issue");
        persistedTicket(secondCustomer, "Second customer issue");

        mockMvc.perform(get("/api/v1/tickets").with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets").with(authentication(administrator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets/{id}", first.getId()).with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(firstCustomer.getId()));
        mockMvc.perform(get("/api/v1/tickets/{id}", first.getId()).with(authentication(administrator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(firstCustomer.getId()));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", first.getId()).with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", first.getId()).with(authentication(administrator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void supportQueueFiltersAndSearchExecuteServerSideAndCanBeCombined() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Ticket passwordReset = persistedTicket(customer, "Password reset failure");
        Ticket passwordEmail = persistedTicket(customer, "Password reset email delay");
        Ticket billing = persistedTicket(customer, "Billing address problem");
        updateTicket(passwordReset, "OPEN", "HIGH", agent.getId());
        updateTicket(passwordEmail, "OPEN", "HIGH", agent.getId());
        updateTicket(billing, "RESOLVED", "LOW", null);
        entityManager.clear();

        mockMvc.perform(get("/api/v1/tickets?status=OPEN").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets?priority=LOW").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/v1/tickets?assignedAgentId={id}", agent.getId()).with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets?unassigned=true").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(billing.getId()));
        mockMvc.perform(get("/api/v1/tickets?search=SUP-{id}", passwordReset.getId()).with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(passwordReset.getId()));
        mockMvc.perform(get("/api/v1/tickets").param("search", "password reset").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets?status=OPEN&priority=HIGH&assignedAgentId={id}&search=password", agent.getId()).with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void invalidFilterCombinationMaximumPageSizeAndInvalidSortReturnProblemDetails() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);

        mockMvc.perform(get("/api/v1/tickets?assignedAgentId=3&unassigned=true").with(authentication(agent)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/tickets?size=101").with(authentication(agent)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/tickets?sort=customer,asc").with(authentication(agent)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private Ticket persistedTicket(User customer, String title) {
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, title, "A detailed description of the support issue."));
        ticketHistoryRepository.saveAndFlush(TicketHistory.ticketCreated(ticket, customer));
        return ticket;
    }

    private User persistedUser(String email, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, "hash", "Test", role.name(), role));
    }

    private void updateTicket(Ticket ticket, String status, String priority, Long assignedAgentId) {
        jdbcTemplate.update("UPDATE tickets SET status = ?, priority = ?, assigned_agent_id = ? WHERE id = ?",
                status, priority, assignedAgentId, ticket.getId());
    }

    private RequestPostProcessor authentication(User user) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user));
    }
}
