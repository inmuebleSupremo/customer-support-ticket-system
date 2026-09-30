package com.resolvedesk.users.api;

import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agents")
public class AgentController {
    private final UserRepository userRepository;

    public AgentController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<AgentSummaryResponse> listAgents(@RequestParam(required = false) Long teamId) {
        List<com.resolvedesk.users.domain.User> agents = teamId == null
                ? userRepository.findByRoleAndActiveTrueOrderByFirstNameAscLastNameAsc(UserRole.AGENT)
                : userRepository.findByTeamIdAndRoleAndActiveTrueOrderByFirstNameAscLastNameAsc(teamId, UserRole.AGENT);
        return agents.stream()
                .map(user -> new AgentSummaryResponse(user.getId(), user.getFirstName() + " " + user.getLastName(), user.getEmail()))
                .toList();
    }
}
