package com.resolvedesk.tickets.comments.application;

import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.tickets.application.TicketClosedException;
import com.resolvedesk.tickets.application.TicketNotFoundException;
import com.resolvedesk.tickets.comments.api.CommentAuthorResponse;
import com.resolvedesk.tickets.comments.api.CommentResponse;
import com.resolvedesk.tickets.comments.api.CreateCommentRequest;
import com.resolvedesk.tickets.comments.domain.Comment;
import com.resolvedesk.tickets.comments.persistence.CommentRepository;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.domain.TicketStatus;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketCommentService {

    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;

    public TicketCommentService(TicketRepository ticketRepository, CommentRepository commentRepository) {
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<CommentResponse> getComments(User actor, long ticketId, int page, int size) {
        findAccessibleTicket(actor, ticketId);
        return PageResponse.from(commentRepository.findByTicketId(ticketId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "createdAt"))), TicketCommentService::toResponse);
    }

    @Transactional
    public CommentResponse createComment(User actor, long ticketId, CreateCommentRequest request) {
        Ticket ticket = findAccessibleTicket(actor, ticketId);
        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new TicketClosedException("Comments cannot be added to a closed ticket.");
        }
        Comment comment = Comment.create(ticket, actor, request.content().trim());
        ticket.touch();
        ticketRepository.saveAndFlush(ticket);
        Comment savedComment = commentRepository.save(comment);
        return toResponse(savedComment);
    }

    private Ticket findAccessibleTicket(User actor, long ticketId) {
        if (actor.getRole() == UserRole.CUSTOMER) {
            return ticketRepository.findByIdAndCustomerId(ticketId, actor.getId())
                    .orElseThrow(TicketNotFoundException::new);
        }
        return ticketRepository.findById(ticketId).orElseThrow(TicketNotFoundException::new);
    }

    private static CommentResponse toResponse(Comment comment) {
        User author = comment.getAuthor();
        return new CommentResponse(comment.getId(), new CommentAuthorResponse(author.getId(),
                author.getFirstName() + " " + author.getLastName(), author.getRole()), comment.getContent(), comment.getCreatedAt());
    }
}
