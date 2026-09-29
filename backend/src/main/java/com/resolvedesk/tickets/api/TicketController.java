package com.resolvedesk.tickets.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.tickets.application.TicketCreationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {

    private final TicketCreationService ticketCreationService;

    public TicketController(TicketCreationService ticketCreationService) {
        this.ticketCreationService = ticketCreationService;
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
}
