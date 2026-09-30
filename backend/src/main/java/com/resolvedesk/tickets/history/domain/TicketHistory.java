package com.resolvedesk.tickets.history.domain;

import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.users.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ticket_history")
public class TicketHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TicketEventType eventType;

    @Column(length = 50)
    private String fieldName;

    @Column(length = 255)
    private String oldValue;

    @Column(length = 255)
    private String newValue;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected TicketHistory() {
    }

    private TicketHistory(Ticket ticket, User actor) {
        this.ticket = ticket;
        this.actor = actor;
        this.eventType = TicketEventType.TICKET_CREATED;
    }

    public static TicketHistory ticketCreated(Ticket ticket, User actor) {
        return new TicketHistory(ticket, actor);
    }

    public static TicketHistory statusChanged(Ticket ticket, User actor, String oldValue, String newValue) {
        return changed(ticket, actor, TicketEventType.STATUS_CHANGED, "status", oldValue, newValue);
    }

    public static TicketHistory assignmentChanged(Ticket ticket, User actor, Long oldAgentId, Long newAgentId) {
        return changed(ticket, actor, TicketEventType.ASSIGNMENT_CHANGED, "assignedAgent",
                oldAgentId == null ? null : oldAgentId.toString(),
                newAgentId == null ? null : newAgentId.toString());
    }

    public static TicketHistory priorityChanged(Ticket ticket, User actor, String oldValue, String newValue) {
        return changed(ticket, actor, TicketEventType.PRIORITY_CHANGED, "priority", oldValue, newValue);
    }

    public static TicketHistory teamChanged(Ticket ticket, User actor, Long oldTeamId, Long newTeamId) {
        return changed(ticket, actor, TicketEventType.TEAM_CHANGED, "assignedTeam",
                oldTeamId == null ? null : oldTeamId.toString(), newTeamId == null ? null : newTeamId.toString());
    }

    private static TicketHistory changed(
            Ticket ticket, User actor, TicketEventType eventType, String fieldName, String oldValue, String newValue
    ) {
        TicketHistory history = new TicketHistory(ticket, actor);
        history.eventType = eventType;
        history.fieldName = fieldName;
        history.oldValue = oldValue;
        history.newValue = newValue;
        return history;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Ticket getTicket() { return ticket; }
    public User getActor() { return actor; }
    public TicketEventType getEventType() { return eventType; }
    public String getFieldName() { return fieldName; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public Instant getCreatedAt() { return createdAt; }
}
