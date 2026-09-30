package com.resolvedesk.users.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.teams.persistence.TeamRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AgentLookupIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository users;
    @Autowired private TeamRepository teams;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM team_members");
        teams.deleteAll();
        users.deleteAll();
    }

    @Test
    void unfilteredLookupPreservesTheExistingActiveAgentResponse() throws Exception {
        User member = persistedUser("member@example.com", "Alpha", "Agent", UserRole.AGENT);
        User nonMember = persistedUser("non-member@example.com", "Beta", "Agent", UserRole.AGENT);
        User inactive = persistedUser("inactive@example.com", "Inactive", "Agent", UserRole.AGENT);
        persistedUser("customer@example.com", "Test", "Customer", UserRole.CUSTOMER);
        persistedUser("admin@example.com", "Test", "Admin", UserRole.ADMIN);
        addMember(Team.create("Billing"), member);
        jdbc.update("UPDATE users SET active = false WHERE id = ?", inactive.getId());

        mockMvc.perform(get("/api/v1/agents").with(authentication(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(member.getId()))
                .andExpect(jsonPath("$[0].displayName").value("Alpha Agent"))
                .andExpect(jsonPath("$[0].email").value("member@example.com"))
                .andExpect(jsonPath("$[1].id").value(nonMember.getId()));
    }

    @Test
    void filtersLookupToActiveMembersOfTheRequestedTeam() throws Exception {
        User actor = persistedUser("actor@example.com", "Actor", "Agent", UserRole.AGENT);
        User matchingMember = persistedUser("member@example.com", "Matching", "Agent", UserRole.AGENT);
        Team team = Team.create("Billing");
        addMember(team, actor, matchingMember);

        mockMvc.perform(get("/api/v1/agents").queryParam("teamId", String.valueOf(team.getId())).with(authentication(actor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(actor.getId()))
                .andExpect(jsonPath("$[1].id").value(matchingMember.getId()));
    }

    @Test
    void teamFilteredLookupExcludesNonMembersAndInactiveAgents() throws Exception {
        User actor = persistedUser("actor@example.com", "Actor", "Agent", UserRole.AGENT);
        User activeMember = persistedUser("active@example.com", "Active", "Member", UserRole.AGENT);
        User inactiveMember = persistedUser("inactive@example.com", "Inactive", "Member", UserRole.AGENT);
        persistedUser("non-member@example.com", "Non", "Member", UserRole.AGENT);
        Team team = Team.create("Technical");
        addMember(team, activeMember, inactiveMember);
        jdbc.update("UPDATE users SET active = false WHERE id = ?", inactiveMember.getId());

        mockMvc.perform(get("/api/v1/agents").queryParam("teamId", String.valueOf(team.getId())).with(authentication(actor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(activeMember.getId()));
    }

    @Test
    void permitsStaffAndDeniesCustomersForBothLookupVariants() throws Exception {
        User agent = persistedUser("agent@example.com", "Agent", "User", UserRole.AGENT);
        User admin = persistedUser("admin@example.com", "Admin", "User", UserRole.ADMIN);
        User customer = persistedUser("customer@example.com", "Customer", "User", UserRole.CUSTOMER);
        Team team = Team.create("Platform");
        addMember(team, agent);

        mockMvc.perform(get("/api/v1/agents").queryParam("teamId", String.valueOf(team.getId())).with(authentication(agent)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/agents").queryParam("teamId", String.valueOf(team.getId())).with(authentication(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/agents").with(authentication(customer)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/agents").queryParam("teamId", String.valueOf(team.getId())).with(authentication(customer)))
                .andExpect(status().isForbidden());
    }

    private Team addMember(Team team, User... members) {
        for (User member : members) team.addMember(member);
        return teams.saveAndFlush(team);
    }

    private User persistedUser(String email, String firstName, String lastName, UserRole role) {
        return users.saveAndFlush(User.create(email, "hash", firstName, lastName, role));
    }

    private RequestPostProcessor authentication(User user) {
        return user(new AuthenticatedUser(user));
    }
}
