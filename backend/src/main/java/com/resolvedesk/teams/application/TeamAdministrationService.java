package com.resolvedesk.teams.application;

import com.resolvedesk.teams.api.ChangeTeamActiveStateRequest;
import com.resolvedesk.teams.api.ChangeTeamNameRequest;
import com.resolvedesk.teams.api.CreateTeamRequest;
import com.resolvedesk.teams.api.TeamDetailResponse;
import com.resolvedesk.teams.api.TeamSummaryResponse;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.teams.persistence.TeamRepository;
import com.resolvedesk.tickets.domain.TicketStatus;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.application.UserNotFoundException;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TeamAdministrationService {
    private static final List<TicketStatus> NON_CLOSED_TICKET_STATUSES = List.of(
            TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED
    );

    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;

    public TeamAdministrationService(
            TeamRepository teamRepository,
            UserRepository userRepository,
            TicketRepository ticketRepository
    ) {
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional(readOnly = true)
    public List<TeamSummaryResponse> listActiveTeams() {
        return teamRepository.findByActiveTrueOrderByNameAsc().stream().map(TeamResponseMapper::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<TeamSummaryResponse> listCurrentUsersActiveTeams(User user) {
        return teamRepository.findDistinctByMembersIdAndActiveTrueOrderByNameAsc(user.getId()).stream()
                .map(TeamResponseMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public TeamDetailResponse getTeam(long teamId) {
        return TeamResponseMapper.toDetail(findTeam(teamId));
    }

    @Transactional
    public TeamDetailResponse create(CreateTeamRequest request) {
        String name = normalizedName(request.name());
        requireAvailableName(name, null);
        Team team = teamRepository.saveAndFlush(Team.create(name));
        return TeamResponseMapper.toDetail(team);
    }

    @Transactional
    public TeamDetailResponse changeName(long teamId, ChangeTeamNameRequest request) {
        Team team = findTeam(teamId);
        String name = normalizedName(request.name());
        requireAvailableName(name, team.getId());
        team.changeName(name);
        return TeamResponseMapper.toDetail(team);
    }

    @Transactional
    public TeamDetailResponse changeActive(long teamId, ChangeTeamActiveStateRequest request) {
        Team team = findTeam(teamId);
        if (team.isActive() && !request.active()
                && ticketRepository.existsByAssignedTeamIdAndStatusIn(teamId, NON_CLOSED_TICKET_STATUSES)) {
            throw new TeamHasActiveTicketsException();
        }
        team.changeActive(request.active());
        return TeamResponseMapper.toDetail(team);
    }

    @Transactional
    public TeamDetailResponse addMember(long teamId, long userId) {
        Team team = findTeam(teamId);
        User user = userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException(userId));
        if (user.getRole() != UserRole.AGENT) {
            throw new InvalidTeamMemberException();
        }
        team.addMember(user);
        return TeamResponseMapper.toDetail(team);
    }

    @Transactional
    public TeamDetailResponse removeMember(long teamId, long userId) {
        Team team = teamRepository.findByIdForUpdate(teamId).orElseThrow(() -> new TeamNotFoundException(teamId));
        User user = userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException(userId));
        if (ticketRepository.existsByAssignedAgentIdAndAssignedTeamIdAndStatusIn(
                user.getId(), team.getId(), NON_CLOSED_TICKET_STATUSES
        )) {
            throw new TeamMemberHasActiveTicketsException();
        }
        team.removeMember(user);
        return TeamResponseMapper.toDetail(team);
    }

    private Team findTeam(long teamId) {
        return teamRepository.findById(teamId).orElseThrow(() -> new TeamNotFoundException(teamId));
    }

    private void requireAvailableName(String name, Long teamId) {
        boolean taken = teamId == null ? teamRepository.existsByName(name) : teamRepository.existsByNameAndIdNot(name, teamId);
        if (taken) {
            throw new TeamNameAlreadyExistsException();
        }
    }

    private String normalizedName(String name) {
        return name.trim();
    }
}
