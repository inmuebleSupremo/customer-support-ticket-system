package com.resolvedesk.tickets.comments.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.comments.application.TicketCommentService;
import jakarta.validation.Valid;
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

@RestController
@RequestMapping("/api/v1/tickets/{ticketId}/comments")
public class TicketCommentController {

    private final TicketCommentService ticketCommentService;

    public TicketCommentController(TicketCommentService ticketCommentService) {
        this.ticketCommentService = ticketCommentService;
    }

    @GetMapping
    public PageResponse<CommentResponse> getComments(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long ticketId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ticketCommentService.getComments(authenticatedUser.user(), ticketId, page, size);
    }

    @PostMapping
    public ResponseEntity<CommentResponse> createComment(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable long ticketId,
            @Valid @RequestBody CreateCommentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ticketCommentService.createComment(authenticatedUser.user(), ticketId, request));
    }
}
