package com.resolvedesk.teams.api;

import com.resolvedesk.teams.application.TeamAdministrationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/teams")
public class TeamController {
    private final TeamAdministrationService teamAdministrationService;

    public TeamController(TeamAdministrationService teamAdministrationService) {
        this.teamAdministrationService = teamAdministrationService;
    }

    @GetMapping
    public List<TeamSummaryResponse> listActiveTeams() {
        return teamAdministrationService.listActiveTeams();
    }

    @GetMapping("/{id}")
    public TeamDetailResponse getTeam(@PathVariable long id) {
        return teamAdministrationService.getTeam(id);
    }

    @PostMapping
    public ResponseEntity<TeamDetailResponse> create(@Valid @RequestBody CreateTeamRequest request) {
        TeamDetailResponse response = teamAdministrationService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.LOCATION, "/api/v1/teams/" + response.id())
                .body(response);
    }

    @PatchMapping("/{id}/name")
    public TeamDetailResponse changeName(@PathVariable long id, @Valid @RequestBody ChangeTeamNameRequest request) {
        return teamAdministrationService.changeName(id, request);
    }

    @PatchMapping("/{id}/active")
    public TeamDetailResponse changeActive(@PathVariable long id, @Valid @RequestBody ChangeTeamActiveStateRequest request) {
        return teamAdministrationService.changeActive(id, request);
    }

    @PutMapping("/{id}/members/{userId}")
    public TeamDetailResponse addMember(@PathVariable long id, @PathVariable long userId) {
        return teamAdministrationService.addMember(id, userId);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public TeamDetailResponse removeMember(@PathVariable long id, @PathVariable long userId) {
        return teamAdministrationService.removeMember(id, userId);
    }
}
