package com.resolvedesk.tickets.application;

import com.resolvedesk.teams.api.ChangeTeamActiveStateRequest;
import com.resolvedesk.teams.application.TeamAdministrationService;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.teams.persistence.TeamRepository;
import com.resolvedesk.tickets.api.ChangeTicketAssigneeRequest;
import com.resolvedesk.tickets.api.ChangeTicketTeamRequest;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.application.UserAdministrationService;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

@SpringBootTest
@ActiveProfiles("test")
class EligibilityConcurrencyIntegrationTests {

    private static final long TIMEOUT_SECONDS = 5;

    @Autowired private TicketWorkflowService ticketWorkflowService;
    @Autowired private TeamAdministrationService teamAdministrationService;
    @Autowired private UserAdministrationService userAdministrationService;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;

    @AfterEach
    void cleanDatabase() {
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM team_members");
        teamRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void teamDeactivationSerializesWithRoutingAndLeavesTheTicketUnrouted() throws Exception {
        User actor = user("admin@example.com", UserRole.ADMIN);
        User customer = user("customer@example.com", UserRole.CUSTOMER);
        Team team = team("Technical Support");
        Ticket ticket = ticket(customer);

        CountDownLatch teamLocked = new CountDownLatch(1);
        CountDownLatch releaseDeactivation = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> deactivate = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                teamRepository.findByIdForUpdate(team.getId()).orElseThrow();
                teamLocked.countDown();
                await(releaseDeactivation);
                teamAdministrationService.changeActive(team.getId(), new ChangeTeamActiveStateRequest(false));
            }));
            await(teamLocked);

            Future<?> route = executor.submit(() -> ticketWorkflowService.changeTeam(actor, ticket.getId(),
                    new ChangeTicketTeamRequest(team.getId(), 0L)));
            releaseDeactivation.countDown();

            deactivate.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            assertThat(failure(route)).isInstanceOf(InactiveTeamException.class);
        }

        assertThat(teamRepository.findById(team.getId()).orElseThrow().isActive()).isFalse();
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getAssignedTeam()).isNull();
    }

    @Test
    void memberRemovalSerializesWithAssignmentAndRejectsTheIneligibleAssignment() throws Exception {
        User actor = user("admin@example.com", UserRole.ADMIN);
        User customer = user("customer@example.com", UserRole.CUSTOMER);
        User agent = user("agent@example.com", UserRole.AGENT);
        Team team = teamWithMember("Technical Support", agent);
        Ticket ticket = ticket(customer);
        jdbcTemplate.update("UPDATE tickets SET assigned_team_id = ? WHERE id = ?", team.getId(), ticket.getId());

        CountDownLatch eligibilityLocked = new CountDownLatch(1);
        CountDownLatch releaseRemoval = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> removeMember = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                userRepository.findByIdForUpdate(agent.getId()).orElseThrow();
                teamRepository.findByIdForUpdate(team.getId()).orElseThrow();
                eligibilityLocked.countDown();
                await(releaseRemoval);
                teamAdministrationService.removeMember(team.getId(), agent.getId());
            }));
            await(eligibilityLocked);

            Future<?> assign = executor.submit(() -> ticketWorkflowService.changeAssignee(actor, ticket.getId(),
                    new ChangeTicketAssigneeRequest(agent.getId(), 0L)));
            releaseRemoval.countDown();

            removeMember.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            assertThat(failure(assign)).isInstanceOf(AssigneeNotInTeamException.class);
        }

        assertThat(teamRepository.existsByIdAndMembersId(team.getId(), agent.getId())).isFalse();
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getAssignedAgent()).isNull();
    }

    @Test
    void memberRemovalSerializesWithRoutingAndClearsAnAgentWhoIsNoLongerAMember() throws Exception {
        User actor = user("admin@example.com", UserRole.ADMIN);
        User customer = user("customer@example.com", UserRole.CUSTOMER);
        User agent = user("agent@example.com", UserRole.AGENT);
        Team team = teamWithMember("Technical Support", agent);
        Ticket ticket = ticket(customer);
        jdbcTemplate.update("UPDATE tickets SET assigned_agent_id = ? WHERE id = ?", agent.getId(), ticket.getId());

        CountDownLatch eligibilityLocked = new CountDownLatch(1);
        CountDownLatch releaseRemoval = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> removeMember = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                userRepository.findByIdForUpdate(agent.getId()).orElseThrow();
                teamRepository.findByIdForUpdate(team.getId()).orElseThrow();
                eligibilityLocked.countDown();
                await(releaseRemoval);
                teamAdministrationService.removeMember(team.getId(), agent.getId());
            }));
            await(eligibilityLocked);

            Future<?> route = executor.submit(() -> ticketWorkflowService.changeTeam(actor, ticket.getId(),
                    new ChangeTicketTeamRequest(team.getId(), 0L)));
            releaseRemoval.countDown();

            removeMember.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            route.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        }

        Ticket persistedTicket = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(teamRepository.existsByIdAndMembersId(team.getId(), agent.getId())).isFalse();
        assertThat(persistedTicket.getAssignedTeam().getId()).isEqualTo(team.getId());
        assertThat(persistedTicket.getAssignedAgent()).isNull();
    }

    @Test
    void agentDeactivationSerializesWithAssignmentAndRejectsTheInactiveAgent() throws Exception {
        User actor = user("admin@example.com", UserRole.ADMIN);
        User customer = user("customer@example.com", UserRole.CUSTOMER);
        User agent = user("agent@example.com", UserRole.AGENT);
        Ticket ticket = ticket(customer);

        CountDownLatch userLocked = new CountDownLatch(1);
        CountDownLatch releaseDeactivation = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> deactivate = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                userRepository.findByIdForUpdate(agent.getId()).orElseThrow();
                userLocked.countDown();
                await(releaseDeactivation);
                userAdministrationService.changeActive(agent.getId(), false);
            }));
            await(userLocked);

            Future<?> assign = executor.submit(() -> ticketWorkflowService.changeAssignee(actor, ticket.getId(),
                    new ChangeTicketAssigneeRequest(agent.getId(), 0L)));
            releaseDeactivation.countDown();

            deactivate.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            assertThat(failure(assign)).isInstanceOf(InvalidAssigneeException.class);
        }

        assertThat(userRepository.findById(agent.getId()).orElseThrow().isActive()).isFalse();
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getAssignedAgent()).isNull();
    }

    @Test
    void roleChangeSerializesWithAssignmentAndRejectsTheNonAgent() throws Exception {
        User actor = user("admin@example.com", UserRole.ADMIN);
        User customer = user("customer@example.com", UserRole.CUSTOMER);
        User agent = user("agent@example.com", UserRole.AGENT);
        Ticket ticket = ticket(customer);

        CountDownLatch userLocked = new CountDownLatch(1);
        CountDownLatch releaseRoleChange = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> changeRole = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                userRepository.findByIdForUpdate(agent.getId()).orElseThrow();
                userLocked.countDown();
                await(releaseRoleChange);
                userAdministrationService.changeRole(agent.getId(), UserRole.CUSTOMER);
            }));
            await(userLocked);

            Future<?> assign = executor.submit(() -> ticketWorkflowService.changeAssignee(actor, ticket.getId(),
                    new ChangeTicketAssigneeRequest(agent.getId(), 0L)));
            releaseRoleChange.countDown();

            changeRole.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            assertThat(failure(assign)).isInstanceOf(InvalidAssigneeException.class);
        }

        assertThat(userRepository.findById(agent.getId()).orElseThrow().getRole()).isEqualTo(UserRole.CUSTOMER);
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getAssignedAgent()).isNull();
    }

    private User user(String email, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, "hash", "Test", role.name(), role));
    }

    private Team team(String name) {
        return teamRepository.saveAndFlush(Team.create(name));
    }

    private Team teamWithMember(String name, User agent) {
        Team team = Team.create(name);
        team.addMember(agent);
        return teamRepository.saveAndFlush(team);
    }

    private Ticket ticket(User customer) {
        return ticketRepository.saveAndFlush(Ticket.create(customer, "A support issue", "A detailed support issue description."));
    }

    private void await(CountDownLatch latch) {
        try {
            assertThat(latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)).isTrue();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            fail("Interrupted while coordinating concurrent operations", exception);
        }
    }

    private Throwable failure(Future<?> future) throws Exception {
        try {
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return fail("Expected the competing operation to be rejected");
        } catch (ExecutionException exception) {
            return exception.getCause();
        }
    }
}
