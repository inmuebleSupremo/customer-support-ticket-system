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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TicketWorkflowIntegrationTests {

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
    void agentLookupIncludesOnlyActiveAgentsAndExcludesCustomersAndAdministrators() throws Exception {
        User agent = persistedUser("agent@example.com", "Active", "Agent", UserRole.AGENT);
        User inactiveAgent = persistedUser("inactive@example.com", "Inactive", "Agent", UserRole.AGENT);
        persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        persistedUser("admin@example.com", "Test", "Admin", UserRole.ADMIN);
        jdbcTemplate.update("UPDATE users SET active = false WHERE id = ?", inactiveAgent.getId());
        entityManager.clear();

        mockMvc.perform(get("/api/v1/agents").with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(agent.getId()))
                .andExpect(jsonPath("$[0].displayName").value("Active Agent"))
                .andExpect(jsonPath("$[0].email").value("agent@example.com"));
        mockMvc.perform(get("/api/v1/agents").with(authentication(persistedUser("another@example.com", "Another", "Customer", UserRole.CUSTOMER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCanAssignReassignAndUnassignOnlyActiveAgentsWithImmutableHistory() throws Exception {
        User actor = persistedUser("actor@example.com", "Staff", "Agent", UserRole.AGENT);
        User otherAgent = persistedUser("other@example.com", "Other", "Agent", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        User invalidCustomer = persistedUser("invalid@example.com", "Invalid", "Customer", UserRole.CUSTOMER);
        User administrator = persistedUser("admin@example.com", "Test", "Admin", UserRole.ADMIN);
        User inactiveAgent = persistedUser("inactive@example.com", "Inactive", "Agent", UserRole.AGENT);
        Ticket ticket = persistedTicket(customer);
        jdbcTemplate.update("UPDATE users SET active = false WHERE id = ?", inactiveAgent.getId());
        entityManager.clear();

        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + actor.getId() + ",\"version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignedAgent.id").value(actor.getId()))
                .andExpect(jsonPath("$.version").value(1));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + otherAgent.getId() + ",\"version\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignedAgent.id").value(otherAgent.getId()))
                .andExpect(jsonPath("$.version").value(2));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":null,\"version\":2}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignedAgent").value(nullValue()))
                .andExpect(jsonPath("$.version").value(3));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", ticket.getId()).with(authentication(actor)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[1].eventType").value("ASSIGNMENT_CHANGED"))
                .andExpect(jsonPath("$[1].fieldName").value("assignedAgent"))
                .andExpect(jsonPath("$[1].oldDisplayValue").value("Unassigned"))
                .andExpect(jsonPath("$[1].newDisplayValue").value("Staff Agent"));

        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + invalidCustomer.getId() + ",\"version\":3}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_ASSIGNEE"));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + administrator.getId() + ",\"version\":3}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_ASSIGNEE"));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + inactiveAgent.getId() + ",\"version\":3}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_ASSIGNEE"));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(customer)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + actor.getId() + ",\"version\":3}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void statusWorkflowSetsResolutionAndClosureTimestampsAndRejectsInvalidTransitions() throws Exception {
        User agent = persistedUser("agent@example.com", "Test", "Agent", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        Ticket ticket = persistedTicket(customer);

        changeStatus(agent, ticket, "IN_PROGRESS", 0).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        changeStatus(agent, ticket, "RESOLVED", 1).andExpect(status().isOk()).andExpect(jsonPath("$.resolvedAt").isNotEmpty()).andExpect(jsonPath("$.version").value(2));
        changeStatus(agent, ticket, "IN_PROGRESS", 2).andExpect(status().isOk()).andExpect(jsonPath("$.resolvedAt").value(nullValue())).andExpect(jsonPath("$.version").value(3));
        changeStatus(agent, ticket, "OPEN", 3).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(4));
        changeStatus(agent, ticket, "CLOSED", 4).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));

        jdbcTemplate.update("UPDATE tickets SET status = 'RESOLVED', version = 0, resolved_at = CURRENT_TIMESTAMP WHERE id = ?", ticket.getId());
        entityManager.clear();
        changeStatus(customer, ticket, "IN_PROGRESS", 0).andExpect(status().isOk()).andExpect(jsonPath("$.resolvedAt").value(nullValue()));
        Ticket ticketToClose = persistedTicket(customer);
        changeStatus(agent, ticketToClose, "IN_PROGRESS", 0).andExpect(status().isOk());
        changeStatus(agent, ticketToClose, "RESOLVED", 1).andExpect(status().isOk());
        changeStatus(agent, ticketToClose, "CLOSED", 2).andExpect(status().isOk()).andExpect(jsonPath("$.closedAt").isNotEmpty());
        Ticket otherTicket = persistedTicket(persistedUser("other@example.com", "Other", "Customer", UserRole.CUSTOMER));
        changeStatus(customer, otherTicket, "IN_PROGRESS", 0).andExpect(status().isNotFound());
    }

    @Test
    void closedTicketsAndStaleVersionsCannotOverwriteNewerTicketState() throws Exception {
        User agent = persistedUser("agent@example.com", "Test", "Agent", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        Ticket ticket = persistedTicket(customer);

        changeStatus(agent, ticket, "IN_PROGRESS", 99).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_RESOURCE"));
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getStatus().name()).isEqualTo("OPEN");
        jdbcTemplate.update("UPDATE tickets SET status = 'CLOSED' WHERE id = ?", ticket.getId());
        entityManager.clear();
        changeStatus(agent, ticket, "IN_PROGRESS", 0).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TICKET_CLOSED"));
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticket.getId()).with(authentication(agent)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":null,\"version\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TICKET_CLOSED"));
    }

    private org.springframework.test.web.servlet.ResultActions changeStatus(User actor, Ticket ticket, String status, long version) throws Exception {
        return mockMvc.perform(patch("/api/v1/tickets/{id}/status", ticket.getId()).with(authentication(actor)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\",\"version\":" + version + "}"));
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
