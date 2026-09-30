# ResolveDesk Architecture

## System relationship

ResolveDesk has a React/TypeScript frontend, a Spring Boot REST backend, and a MySQL database. The frontend communicates only through DTO-based HTTP endpoints. In the Docker environment, Nginx serves the frontend and proxies `/api`, `/api-docs`, and `/swagger-ui` to Spring Boot, so browser API calls remain same-origin. MySQL is reachable by the backend over the Compose network.

## Backend structure

The backend is organized by feature rather than by global technical layer:

```text
auth/                     registration, login, logout, CSRF, bootstrap administrator
users/                    current user, agent lookup, user administration
teams/                    team administration and current membership
tickets/                  ticket creation, workspace, global queue, routing, assignment, lifecycle, priority
tickets/comments/         immutable conversation records
tickets/history/          immutable ticket workflow history
shared/                   Problem Details, pagination, security configuration
```

Controllers are thin: they bind/validate HTTP input, obtain the authenticated user where needed, and call application services. Services enforce business rules and transaction boundaries. Repositories use Spring Data JPA and specifications for server-side queries. JPA entities are internal persistence models; response and request DTOs define the REST boundary.

## Security and authorization

Spring Security uses server-side sessions, BCrypt password hashes, and CSRF tokens. Authentication and authorization are authoritative in the backend: client requests cannot choose a ticket owner, comment author, workflow actor, assignee, or team-routing actor. Customers can access only their own tickets; AGENT and ADMIN users can access the global support queue; user and team administration endpoints require ADMIN.

Users and teams are deactivated rather than deleted. Inactive users cannot authenticate, and only active AGENT users appear in assignment lookup and can receive assignments. The bootstrap administrator is configured through environment variables; there is no public ADMIN-creation endpoint.

Teams are operational groups, not ticket-visibility boundaries. The queue remains global for AGENT and ADMIN users; its team, unrouted, and My Teams filters refine a query rather than grant access. Team Administration lets ADMIN users create, rename, activate/deactivate, and manage current AGENT membership. The API exposes only active teams to AGENT users; ADMIN may include inactive teams for administration.

## Database ownership

Flyway owns the schema and applies V1 (users), V2 (tickets), V3 (ticket history), V4 (comments), V5 (teams and `team_members`), V6 (nullable `tickets.assigned_team_id`), and V7 (`TEAM_CHANGED` history support). `team_members` is a current-membership join table with a composite team/user key; it has no membership-role or membership-history model. `Ticket.assignedTeam` is nullable and independent of nullable `assignedAgent`, so migrated v1 and unrouted tickets remain valid.

Production Hibernate is configured with `ddl-auto: validate`, so it verifies rather than creates or updates schema. Database foreign keys use restrictive deletion behavior for core records. Focused Testcontainers coverage applies V1–V7 to a fresh MySQL 8 database, verifies Hibernate validation, and migrates representative V4 data through V7 without rewriting existing records.

## Ticket workflow and auditability

`Ticket` is the workflow aggregate. New tickets are OPEN, MEDIUM priority, unrouted, and unassigned, and create `TICKET_CREATED` history in the same transaction. Assignment, routing, status, and priority changes create immutable history entries transactionally. Routing adds `TEAM_CHANGED`; if a new team makes the current assignee ineligible, routing also clears that assignee and records `ASSIGNMENT_CHANGED` in the same transaction. Comments are immutable and are their own audit record; no duplicate comment-history event is created.

An active team may own a ticket, but an inactive team cannot own a non-CLOSED ticket. If a ticket has an assigned team, any assigned agent must be an active AGENT and a current member of that team. Removing a member or deactivating a team is rejected while that change would violate those non-CLOSED-ticket invariants. An AGENT cannot be deactivated or changed to another role while they have a non-CLOSED assignment; moving away from AGENT also removes current team memberships.

Eligibility-changing operations use pessimistic database locks on the affected user and team to serialize with routing and assignment. Where both are involved, the lock order is user then team; multi-team role changes lock teams by ascending id. This prevents concurrent administration and workflow requests from persisting an inactive team, ineligible assignee, or non-member assignee. Tickets retain an optimistic-locking version: versioned workflow mutations reject stale requests with `STALE_RESOURCE`, preventing silent overwrites. Comment creation intentionally has no client version field but updates ticket activity and participates in JPA version advancement.

The lifecycle is OPEN → IN_PROGRESS → RESOLVED → CLOSED, with the documented reopen path from RESOLVED to IN_PROGRESS. CLOSED tickets are terminal/read-only for all ticket mutations and comments.
