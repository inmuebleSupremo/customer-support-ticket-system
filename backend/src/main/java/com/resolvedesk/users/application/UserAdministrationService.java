package com.resolvedesk.users.application;

import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.domain.TicketStatus;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.api.UserMutationResponse;
import com.resolvedesk.users.api.UserSummaryResponse;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import com.resolvedesk.users.persistence.UserSpecifications;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserAdministrationService {
    private static final List<TicketStatus> NON_CLOSED_TICKET_STATUSES = List.of(TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED);
    private static final List<TicketStatus> ACTIVE_TICKET_STATUSES = List.of(TicketStatus.OPEN, TicketStatus.IN_PROGRESS);

    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;

    public UserAdministrationService(UserRepository userRepository, TicketRepository ticketRepository) {
        this.userRepository = userRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserSummaryResponse> listUsers(UserListQuery query) {
        return PageResponse.from(userRepository.findAll(UserSpecifications.matches(query), PageRequest.of(query.page(), query.size(), query.sort())),
                UserAdministrationService::toSummary);
    }

    @Transactional
    public UserMutationResponse changeRole(long userId, UserRole requestedRole) {
        User user = findUser(userId);
        if (user.getRole() == UserRole.AGENT && requestedRole != UserRole.AGENT
                && hasAssignedTickets(user, NON_CLOSED_TICKET_STATUSES)) {
            throw new AgentHasActiveTicketsException("Reassign or unassign the agent's non-closed tickets before changing the role.");
        }
        if (user.isActive() && user.getRole() == UserRole.ADMIN && requestedRole != UserRole.ADMIN) {
            ensureNotLastActiveAdmin();
        }
        user.changeRole(requestedRole);
        return toMutation(user);
    }

    @Transactional
    public UserMutationResponse changeActive(long userId, boolean active) {
        User user = findUser(userId);
        if (user.isActive() && !active && user.getRole() == UserRole.AGENT
                && hasAssignedTickets(user, ACTIVE_TICKET_STATUSES)) {
            throw new AgentHasActiveTicketsException("Reassign or unassign the agent's active tickets before deactivating the account.");
        }
        if (user.isActive() && !active && user.getRole() == UserRole.ADMIN) {
            ensureNotLastActiveAdmin();
        }
        user.changeActive(active);
        return toMutation(user);
    }

    private User findUser(long id) {
        return userRepository.findById(id).orElseThrow(() -> new UserNotFoundException(id));
    }

    private boolean hasAssignedTickets(User user, List<TicketStatus> statuses) {
        return ticketRepository.existsByAssignedAgentIdAndStatusIn(user.getId(), statuses);
    }

    private void ensureNotLastActiveAdmin() {
        if (userRepository.findByRoleAndActiveTrue(UserRole.ADMIN).size() <= 1) {
            throw new LastActiveAdminException();
        }
    }

    private static UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole(), user.isActive(), user.getCreatedAt());
    }

    private static UserMutationResponse toMutation(User user) {
        return new UserMutationResponse(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
