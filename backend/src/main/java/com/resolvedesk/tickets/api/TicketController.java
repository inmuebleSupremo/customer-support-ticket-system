package com.resolvedesk.tickets.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.application.TicketCreationService;
import com.resolvedesk.tickets.application.CustomerTicketWorkspaceService;
import com.resolvedesk.tickets.application.TicketQueueQuery;
import com.resolvedesk.tickets.application.TicketWorkflowService;
import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {

    private final TicketCreationService ticketCreationService;
    private final CustomerTicketWorkspaceService customerTicketWorkspaceService;
    private final TicketWorkflowService ticketWorkflowService;

    public TicketController(
            TicketCreationService ticketCreationService,
            CustomerTicketWorkspaceService customerTicketWorkspaceService,
            TicketWorkflowService ticketWorkflowService
    ) {
        this.ticketCreationService = ticketCreationService;
        this.customerTicketWorkspaceService = customerTicketWorkspaceService;
        this.ticketWorkflowService = ticketWorkflowService;
    }

    @PostMapping
    public ResponseEntity<TicketDetailResponse> createTicket(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody CreateTicketRequest request
    ) {
        TicketDetailResponse response = ticketCreationService.create(authenticatedUser.user(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.LOCATION, "/api/v1/tickets/" + response.id())
                .body(response);
    }

    @GetMapping
    public PageResponse<TicketSummaryResponse> listTickets(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String assignedAgentId,
            @RequestParam(required = false) String unassigned,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String unassignedTeam,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort
    ) {
        return customerTicketWorkspaceService.listTickets(authenticatedUser.user(),
                TicketQueueQuery.from(status, priority, assignedAgentId, unassigned, teamId, unassignedTeam, search, page, size, sort));
    }

    @GetMapping("/{id}")
    public TicketDetailResponse getTicket(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id
    ) {
        return customerTicketWorkspaceService.getTicket(authenticatedUser.user(), id);
    }

    @GetMapping("/{id}/history")
    public List<TicketHistoryResponse> getTicketHistory(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id
    ) {
        return customerTicketWorkspaceService.getHistory(authenticatedUser.user(), id);
    }

    @PatchMapping("/{id}/assignee")
    public TicketAssignmentMutationResponse changeAssignee(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id,
            @Valid @RequestBody ChangeTicketAssigneeRequest request
    ) {
        return ticketWorkflowService.changeAssignee(authenticatedUser.user(), id, request);
    }

    @PatchMapping("/{id}/team")
    public TicketTeamMutationResponse changeTeam(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id,
            @Valid @RequestBody ChangeTicketTeamRequest request
    ) {
        return ticketWorkflowService.changeTeam(authenticatedUser.user(), id, request);
    }

    @PatchMapping("/{id}/status")
    public TicketStatusMutationResponse changeStatus(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id,
            @Valid @RequestBody ChangeTicketStatusRequest request
    ) {
        return ticketWorkflowService.changeStatus(authenticatedUser.user(), id, request);
    }

    @PatchMapping("/{id}/priority")
    public TicketPriorityMutationResponse changePriority(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long id,
            @Valid @RequestBody ChangeTicketPriorityRequest request
    ) {
        return ticketWorkflowService.changePriority(authenticatedUser.user(), id, request);
    }
}
