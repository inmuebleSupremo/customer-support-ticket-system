package com.resolvedesk.users.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.domain.TicketStatus;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserAdministrationIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManager entityManager;
    @Autowired private PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanDatabase() {
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void administratorsCanListAndFilterUsersWhileOtherRolesCannot() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        persistedUser("agent@example.com", UserRole.AGENT);
        User matchingCustomer = persistedUser("alexa@example.com", UserRole.CUSTOMER);
        persistedUser("inactive@example.com", UserRole.CUSTOMER);
        jdbcTemplate.update("UPDATE users SET active = false WHERE email = 'inactive@example.com'");
        entityManager.clear();

        mockMvc.perform(get("/api/v1/users").with(authentication(administrator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.content[0].createdAt").isNotEmpty());
        mockMvc.perform(get("/api/v1/users?role=AGENT").with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].role").value("AGENT"));
        mockMvc.perform(get("/api/v1/users?active=false").with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("inactive@example.com"));
        mockMvc.perform(get("/api/v1/users?search=alexa&page=0&size=1&sort=email,asc").with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.content[0].id").value(matchingCustomer.getId()));
        mockMvc.perform(get("/api/v1/users?size=101").with(authentication(administrator)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/users?sort=passwordHash,asc").with(authentication(administrator)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/users").with(authentication(persistedUser("staff@example.com", UserRole.AGENT))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/users").with(authentication(persistedUser("customer@example.com", UserRole.CUSTOMER))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void roleChangesPreserveAssignedTicketInvariantsAndProtectTheFinalActiveAdministrator() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        User openAgent = persistedUser("open-agent@example.com", UserRole.AGENT);
        User inProgressAgent = persistedUser("in-progress-agent@example.com", UserRole.AGENT);
        User resolvedAgent = persistedUser("resolved-agent@example.com", UserRole.AGENT);
        User closedAgent = persistedUser("closed-agent@example.com", UserRole.AGENT);
        Ticket open = assignedTicket(customer, openAgent, TicketStatus.OPEN);
        assignedTicket(customer, inProgressAgent, TicketStatus.IN_PROGRESS);
        assignedTicket(customer, resolvedAgent, TicketStatus.RESOLVED);
        assignedTicket(customer, closedAgent, TicketStatus.CLOSED);
        entityManager.clear();

        mockMvc.perform(patch("/api/v1/users/{id}/role", customer.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"AGENT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("AGENT"));
        rejectRoleChange(administrator, openAgent);
        rejectRoleChange(administrator, inProgressAgent);
        rejectRoleChange(administrator, resolvedAgent);
        assertThat(ticketRepository.findById(open.getId()).orElseThrow().getAssignedAgent().getId()).isEqualTo(openAgent.getId());
        mockMvc.perform(patch("/api/v1/users/{id}/role", closedAgent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"CUSTOMER\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("CUSTOMER"));
        mockMvc.perform(patch("/api/v1/users/{id}/role", administrator.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"AGENT\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMIN"));
        mockMvc.perform(patch("/api/v1/users/{id}/role", customer.getId()).with(authentication(customer)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void activationChangesRejectAgentsWithAnyNonClosedAssignmentAndProtectAdministrators() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        User activeAgent = persistedUser("active-agent@example.com", UserRole.AGENT);
        User resolvedAgent = persistedUser("resolved-agent@example.com", UserRole.AGENT);
        assignedTicket(customer, activeAgent, TicketStatus.OPEN);
        assignedTicket(customer, activeAgent, TicketStatus.IN_PROGRESS);
        assignedTicket(customer, resolvedAgent, TicketStatus.RESOLVED);
        entityManager.clear();

        mockMvc.perform(patch("/api/v1/users/{id}/active", activeAgent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AGENT_HAS_ACTIVE_TICKETS"));
        mockMvc.perform(patch("/api/v1/users/{id}/active", resolvedAgent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AGENT_HAS_ACTIVE_TICKETS"));
        jdbcTemplate.update("UPDATE tickets SET assigned_agent_id = NULL WHERE assigned_agent_id = ?", resolvedAgent.getId());
        entityManager.clear();
        mockMvc.perform(patch("/api/v1/users/{id}/active", resolvedAgent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(get("/api/v1/agents").with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + resolvedAgent.getId() + ")]").isEmpty());
        mockMvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"resolved-agent@example.com\",\"password\":\"ExamplePassword123!\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_INACTIVE"));
        mockMvc.perform(patch("/api/v1/users/{id}/active", resolvedAgent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true));
        mockMvc.perform(patch("/api/v1/users/{id}/active", administrator.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMIN"));
        mockMvc.perform(patch("/api/v1/users/{id}/active", customer.getId()).with(authentication(customer)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
    }

    private void rejectRoleChange(User administrator, User agent) throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}/role", agent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"CUSTOMER\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AGENT_HAS_ACTIVE_TICKETS"));
    }

    private Ticket assignedTicket(User customer, User agent, TicketStatus status) {
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A support issue", "A detailed description of the support issue."));
        jdbcTemplate.update("UPDATE tickets SET assigned_agent_id = ?, status = ? WHERE id = ?", agent.getId(), status.name(), ticket.getId());
        return ticket;
    }

    private User persistedUser(String email, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, passwordEncoder.encode("ExamplePassword123!"), "Test", role.name(), role));
    }

    private RequestPostProcessor authentication(User user) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user));
    }
}
