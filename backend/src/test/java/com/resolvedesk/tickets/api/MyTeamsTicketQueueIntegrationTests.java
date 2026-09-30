package com.resolvedesk.tickets.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.teams.persistence.TeamRepository;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MyTeamsTicketQueueIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository users;
    @Autowired private TeamRepository teams;
    @Autowired private TicketRepository tickets;
    @Autowired private TicketHistoryRepository history;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanDatabase() {
        history.deleteAll();
        tickets.deleteAll();
        jdbc.update("DELETE FROM team_members");
        teams.deleteAll();
        users.deleteAll();
    }

    @Test
    void filtersTicketsToTheAgentsSingleCurrentTeam() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team membersTeam = persistedTeam("Members", agent);
        Team otherTeam = persistedTeam("Other");
        Ticket matching = persistedTicket(customer, "Matching ticket", membersTeam);
        persistedTicket(customer, "Other ticket", otherTeam);
        persistedTicket(customer, "Unrouted ticket", null);

        mockMvc.perform(get("/api/v1/tickets?myTeams=true").with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(matching.getId()));
        mockMvc.perform(get("/api/v1/tickets?myTeams=false").with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void combinesAllOfTheAgentsTeamsAndReturnsNoTicketsForAnAgentWithoutTeams() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User agentWithoutTeams = persistedUser("no-teams@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team alpha = persistedTeam("Alpha", agent);
        Team bravo = persistedTeam("Bravo", agent);
        Team other = persistedTeam("Other");
        Ticket alphaTicket = persistedTicket(customer, "Alpha ticket", alpha);
        Ticket bravoTicket = persistedTicket(customer, "Bravo ticket", bravo);
        persistedTicket(customer, "Other ticket", other);

        mockMvc.perform(get("/api/v1/tickets?myTeams=true&sort=title,asc").with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(alphaTicket.getId()))
                .andExpect(jsonPath("$.content[1].id").value(bravoTicket.getId()));
        mockMvc.perform(get("/api/v1/tickets?myTeams=true").with(user(new AuthenticatedUser(agentWithoutTeams))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void combinesWithExistingFiltersAndKeepsPaginationAndSortingInTheDatabase() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User customer = persistedUser("customer@example.com", UserRole.CUSTOMER);
        Team team = persistedTeam("Support", agent);
        Ticket alpha = persistedTicket(customer, "Alpha password", team);
        Ticket bravo = persistedTicket(customer, "Bravo password", team);
        Ticket charlie = persistedTicket(customer, "Charlie password", team);
        Ticket excluded = persistedTicket(customer, "Other password", team);
        updateTicket(alpha, "OPEN", "HIGH", agent.getId());
        updateTicket(bravo, "OPEN", "HIGH", agent.getId());
        updateTicket(charlie, "OPEN", "HIGH", agent.getId());
        updateTicket(excluded, "RESOLVED", "LOW", null);

        mockMvc.perform(get("/api/v1/tickets?myTeams=true&status=OPEN&priority=HIGH&assignedAgentId={id}&search=password&sort=title,asc&page=1&size=1", agent.getId()).with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bravo.getId()));
    }

    @Test
    void rejectsMyTeamsCombinedWithSpecificOrUnroutedTeamFilters() throws Exception {
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        Team team = persistedTeam("Support", agent);

        mockMvc.perform(get("/api/v1/tickets?myTeams=true&teamId={id}", team.getId()).with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/tickets?myTeams=true&unassignedTeam=true").with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private User persistedUser(String email, UserRole role) {
        return users.saveAndFlush(User.create(email, "hash", "Test", role.name(), role));
    }

    private Team persistedTeam(String name, User... members) {
        Team team = Team.create(name);
        for (User member : members) team.addMember(member);
        return teams.saveAndFlush(team);
    }

    private Ticket persistedTicket(User customer, String title, Team team) {
        Ticket ticket = tickets.saveAndFlush(Ticket.create(customer, title, "A detailed description of the issue."));
        if (team != null) jdbc.update("UPDATE tickets SET assigned_team_id = ? WHERE id = ?", team.getId(), ticket.getId());
        return ticket;
    }

    private void updateTicket(Ticket ticket, String status, String priority, Long assignedAgentId) {
        jdbc.update("UPDATE tickets SET status = ?, priority = ?, assigned_agent_id = ? WHERE id = ?", status, priority, assignedAgentId, ticket.getId());
    }
}
