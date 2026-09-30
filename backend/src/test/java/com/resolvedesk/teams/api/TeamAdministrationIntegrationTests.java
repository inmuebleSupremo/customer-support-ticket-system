package com.resolvedesk.teams.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.teams.persistence.TeamRepository;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.domain.TicketStatus;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TeamAdministrationIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private TeamRepository teamRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManager entityManager;
    @Autowired private PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanDatabase() {
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM team_members");
        teamRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void administratorsCreateAndManageTeamsWhileAgentsOnlyListActiveSummaries() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);

        mockMvc.perform(post("/api/v1/teams").with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" Technical Support \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Technical Support"))
                .andExpect(jsonPath("$.active").value(true));
        Team team = teamRepository.findAll().getFirst();

        mockMvc.perform(get("/api/v1/teams").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Technical Support"))
                .andExpect(jsonPath("$[0].active").value(true));
        mockMvc.perform(get("/api/v1/teams/{id}", team.getId()).with(authentication(agent)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/teams/{id}", team.getId()).with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members").isArray());
        mockMvc.perform(get("/api/v1/teams").with(authentication(customer)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/teams").with(authentication(agent)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Billing\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void teamListingDefaultsToActiveTeamsAndLetsOnlyAdministratorsIncludeInactiveTeams() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team activeTeam = teamRepository.saveAndFlush(Team.create("Active Team"));
        Team inactiveTeam = teamRepository.saveAndFlush(Team.create("Inactive Team"));
        inactiveTeam.changeActive(false);
        teamRepository.saveAndFlush(inactiveTeam);

        mockMvc.perform(get("/api/v1/teams").with(authentication(agent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(activeTeam.getId()))
                .andExpect(jsonPath("$[0].name").value("Active Team"))
                .andExpect(jsonPath("$[0].active").value(true));
        mockMvc.perform(get("/api/v1/teams").queryParam("includeInactive", "true").with(authentication(administrator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Active Team"))
                .andExpect(jsonPath("$[0].active").value(true))
                .andExpect(jsonPath("$[1].name").value("Inactive Team"))
                .andExpect(jsonPath("$[1].active").value(false));
        mockMvc.perform(get("/api/v1/teams").queryParam("includeInactive", "true").with(authentication(agent)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mockMvc.perform(get("/api/v1/teams").with(authentication(customer)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/teams").queryParam("includeInactive", "true").with(authentication(customer)))
                .andExpect(status().isForbidden());
    }

    @Test
    void teamNamesAreValidatedUniqueAndMayBeRenamedByAdministrators() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        Team team = teamRepository.saveAndFlush(Team.create("Technical Support"));
        teamRepository.saveAndFlush(Team.create("Billing"));

        mockMvc.perform(post("/api/v1/teams").with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(post("/api/v1/teams").with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Technical Support\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_NAME_ALREADY_EXISTS"));
        mockMvc.perform(patch("/api/v1/teams/{id}/name", team.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" Billing \"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_NAME_ALREADY_EXISTS"));
        mockMvc.perform(patch("/api/v1/teams/{id}/name", team.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Account Support\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Account Support"));
    }

    @Test
    void membershipIsIdempotentRestrictedToAgentsAndExposedOnlyThroughCurrentUserLookup() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team activeTeam = teamRepository.saveAndFlush(Team.create("Technical Support"));
        Team inactiveTeam = teamRepository.saveAndFlush(Team.create("Billing"));
        inactiveTeam.changeActive(false);
        teamRepository.saveAndFlush(inactiveTeam);

        mockMvc.perform(put("/api/v1/teams/{id}/members/{userId}", activeTeam.getId(), agent.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(1));
        mockMvc.perform(put("/api/v1/teams/{id}/members/{userId}", activeTeam.getId(), agent.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(1));
        mockMvc.perform(put("/api/v1/teams/{id}/members/{userId}", inactiveTeam.getId(), agent.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/teams/{id}/members/{userId}", activeTeam.getId(), customer.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_TEAM_MEMBER"));
        mockMvc.perform(get("/api/v1/users/me/teams").with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(activeTeam.getId()))
                .andExpect(jsonPath("$[0].name").value("Technical Support"))
                .andExpect(jsonPath("$[0].active").value(true));
        mockMvc.perform(get("/api/v1/users/me/teams").with(authentication(customer)))
                .andExpect(status().isForbidden());
    }

    @Test
    void teamDeactivationAndMemberRemovalPreserveNonClosedTicketOwnership() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team team = teamRepository.saveAndFlush(Team.create("Technical Support"));
        team.addMember(agent);
        teamRepository.saveAndFlush(team);
        Ticket ticket = ticketRepository.saveAndFlush(Ticket.create(customer, "A support issue", "A detailed description of the support issue."));
        jdbcTemplate.update("UPDATE tickets SET assigned_team_id = ?, assigned_agent_id = ?, status = ? WHERE id = ?",
                team.getId(), agent.getId(), TicketStatus.RESOLVED.name(), ticket.getId());
        entityManager.clear();

        mockMvc.perform(patch("/api/v1/teams/{id}/active", team.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_HAS_ACTIVE_TICKETS"));
        mockMvc.perform(delete("/api/v1/teams/{id}/members/{userId}", team.getId(), agent.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_MEMBER_HAS_ACTIVE_TICKETS"));
        jdbcTemplate.update("UPDATE tickets SET status = 'CLOSED' WHERE id = ?", ticket.getId());
        entityManager.clear();
        mockMvc.perform(delete("/api/v1/teams/{id}/members/{userId}", team.getId(), agent.getId()).with(authentication(administrator)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(0));
        mockMvc.perform(patch("/api/v1/teams/{id}/active", team.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void changingAnAgentRoleCleansUpMembershipAfterExistingAssignmentChecksPass() throws Exception {
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        Team team = teamRepository.saveAndFlush(Team.create("Technical Support"));
        team.addMember(agent);
        teamRepository.saveAndFlush(team);

        mockMvc.perform(patch("/api/v1/users/{id}/role", agent.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"CUSTOMER\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("CUSTOMER"));
        entityManager.clear();
        mockMvc.perform(get("/api/v1/teams/{id}", team.getId()).with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(0));
    }

    private User persistedUser(String email, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, passwordEncoder.encode("ExamplePassword123!"), "Test", role.name(), role));
    }

    private RequestPostProcessor authentication(User user) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user));
    }
}
