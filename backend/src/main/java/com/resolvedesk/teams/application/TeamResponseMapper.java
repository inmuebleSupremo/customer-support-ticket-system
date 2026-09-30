package com.resolvedesk.teams.application;

import com.resolvedesk.teams.api.TeamDetailResponse;
import com.resolvedesk.teams.api.TeamMemberResponse;
import com.resolvedesk.teams.api.TeamSummaryResponse;
import com.resolvedesk.teams.domain.Team;
import com.resolvedesk.users.domain.User;

import java.util.Comparator;

public final class TeamResponseMapper {
    private TeamResponseMapper() {
    }

    public static TeamSummaryResponse toSummary(Team team) {
        return new TeamSummaryResponse(team.getId(), team.getName(), team.isActive());
    }

    public static TeamDetailResponse toDetail(Team team) {
        return new TeamDetailResponse(
                team.getId(),
                team.getName(),
                team.isActive(),
                team.getMembers().stream()
                        .sorted(Comparator.comparing(User::getFirstName).thenComparing(User::getLastName).thenComparing(User::getId))
                        .map(member -> new TeamMemberResponse(
                                member.getId(),
                                member.getFirstName() + " " + member.getLastName(),
                                member.getEmail(),
                                member.isActive()
                        ))
                        .toList(),
                team.getCreatedAt(),
                team.getUpdatedAt()
        );
    }
}
