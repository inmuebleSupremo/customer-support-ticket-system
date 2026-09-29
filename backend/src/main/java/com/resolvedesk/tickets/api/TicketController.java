package com.resolvedesk.tickets.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.application.TicketCreationService;
import com.resolvedesk.tickets.application.CustomerTicketWorkspaceService;
import com.resolvedesk.tickets.history.api.TicketHistoryResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tickets")
@Validated
public class TicketController {

    private final TicketCreationService ticketCreationService;
    private final CustomerTicketWorkspaceService customerTicketWorkspaceService;

    public TicketController(
            TicketCreationService ticketCreationService,
            CustomerTicketWorkspaceService customerTicketWorkspaceService
    ) {
        this.ticketCreationService = ticketCreationService;
        this.customerTicketWorkspaceService = customerTicketWorkspaceService;
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
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return customerTicketWorkspaceService.listTickets(authenticatedUser.user(), page, size);
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
}
