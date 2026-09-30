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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class TicketTeamRoutingIntegrationTests {
    @Autowired MockMvc mockMvc; @Autowired UserRepository users; @Autowired TeamRepository teams;
    @Autowired TicketRepository tickets; @Autowired TicketHistoryRepository history; @Autowired JdbcTemplate jdbc;

    @AfterEach void clean() { history.deleteAll(); tickets.deleteAll(); jdbc.update("DELETE FROM team_members"); teams.deleteAll(); users.deleteAll(); }

    @Test
    void routingClearsAnIncompatibleAssigneeAuditsBothChangesAndSupportsTeamQueueFilters() throws Exception {
        User agent = users.saveAndFlush(User.create("agent@example.com", "hash", "A", "Agent", UserRole.AGENT));
        User customer = users.saveAndFlush(User.create("customer@example.com", "hash", "C", "Customer", UserRole.CUSTOMER));
        Team technical = teams.saveAndFlush(Team.create("Technical"));
        Team billing = teams.saveAndFlush(Team.create("Billing"));
        billing.addMember(agent); teams.saveAndFlush(billing);
        Ticket ticket = tickets.saveAndFlush(Ticket.create(customer, "Support issue", "A detailed support issue."));
        jdbc.update("UPDATE tickets SET assigned_agent_id = ? WHERE id = ?", agent.getId(), ticket.getId());

        mockMvc.perform(patch("/api/v1/tickets/{id}/team", ticket.getId()).with(user(new AuthenticatedUser(agent))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"teamId\":" + technical.getId() + ",\"version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignedTeam.id").value(technical.getId()))
                .andExpect(jsonPath("$.assignedAgent").value(org.hamcrest.Matchers.nullValue()));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", ticket.getId()).with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].eventType").value("TEAM_CHANGED"))
                .andExpect(jsonPath("$[1].eventType").value("ASSIGNMENT_CHANGED"));
        mockMvc.perform(get("/api/v1/tickets?teamId={id}", technical.getId()).with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/v1/tickets?teamId={id}&unassignedTeam=true", technical.getId()).with(user(new AuthenticatedUser(agent))))
                .andExpect(status().isBadRequest());
    }
}
