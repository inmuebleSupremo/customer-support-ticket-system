package com.resolvedesk.tickets.domain;

import com.resolvedesk.users.domain.User;
import com.resolvedesk.teams.domain.Team;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_agent_id")
    private User assignedAgent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_team_id")
    private Team assignedTeam;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TicketStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketPriority priority;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant resolvedAt;

    private Instant closedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    protected Ticket() {
    }

    private Ticket(User customer, String title, String description) {
        this.customer = customer;
        this.title = title;
        this.description = description;
        this.status = TicketStatus.OPEN;
        this.priority = TicketPriority.MEDIUM;
    }

    public static Ticket create(User customer, String title, String description) {
        return new Ticket(customer, title, description);
    }

    public void assignTo(User agent) {
        assignedAgent = agent;
    }

    public void unassign() {
        assignedAgent = null;
    }

    public void assignTeam(Team team) {
        assignedTeam = team;
    }

    public void clearTeam() {
        assignedTeam = null;
    }

    public void changeStatus(TicketStatus newStatus) {
        status = newStatus;
        if (newStatus == TicketStatus.RESOLVED) {
            resolvedAt = Instant.now();
        } else if (newStatus == TicketStatus.IN_PROGRESS) {
            resolvedAt = null;
        } else if (newStatus == TicketStatus.CLOSED) {
            closedAt = Instant.now();
        }
    }

    public void changePriority(TicketPriority newPriority) {
        priority = newPriority;
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getCustomer() { return customer; }
    public User getAssignedAgent() { return assignedAgent; }
    public Team getAssignedTeam() { return assignedTeam; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public TicketStatus getStatus() { return status; }
    public TicketPriority getPriority() { return priority; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public Instant getClosedAt() { return closedAt; }
    public Long getVersion() { return version; }
}
