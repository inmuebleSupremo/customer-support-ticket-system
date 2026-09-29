# ResolveDesk Architecture

## System relationship

ResolveDesk has a React/TypeScript frontend, a Spring Boot REST backend, and a MySQL database. The frontend communicates only through DTO-based HTTP endpoints. In the Docker environment, Nginx serves the frontend and proxies `/api`, `/api-docs`, and `/swagger-ui` to Spring Boot, so browser API calls remain same-origin. MySQL is reachable by the backend over the Compose network.

## Backend structure

The backend is organized by feature rather than by global technical layer:

```text
auth/                     registration, login, logout, CSRF, bootstrap administrator
users/                    current user, agent lookup, user administration
tickets/                  ticket creation, workspace, queue, lifecycle, priority
tickets/comments/         immutable conversation records
tickets/history/          immutable ticket workflow history
shared/                   Problem Details, pagination, security configuration
```

Controllers are thin: they bind/validate HTTP input, obtain the authenticated user where needed, and call application services. Services enforce business rules and transaction boundaries. Repositories use Spring Data JPA and specifications for server-side queries. JPA entities are internal persistence models; response and request DTOs define the REST boundary.

## Security and authorization

Spring Security uses server-side sessions, BCrypt password hashes, and CSRF tokens. Authentication and authorization are authoritative in the backend: client requests cannot choose a ticket owner, comment author, workflow actor, or assignee. Customers can access only their own tickets; agents and administrators can access the support queue; administration endpoints require ADMIN.

Users are deactivated rather than deleted. Inactive users cannot authenticate, and only active AGENT users appear in assignment lookup and can receive assignments. The bootstrap administrator is configured through environment variables; there is no public ADMIN-creation endpoint.

## Database ownership

Flyway owns the schema and applies V1 (users), V2 (tickets), V3 (ticket history), and V4 (comments). Production Hibernate is configured with `ddl-auto: validate`, so it verifies rather than creates or updates schema. Database foreign keys use restrictive deletion behavior for core records.

## Ticket workflow and auditability

`Ticket` is the workflow aggregate. New tickets are OPEN, MEDIUM priority, unassigned, and create `TICKET_CREATED` history in the same transaction. Assignment, status, and priority changes create immutable history entries transactionally. Comments are immutable and are their own audit record; no duplicate comment-history event is created.

Tickets have an optimistic-locking version. Versioned workflow mutations reject stale requests with `STALE_RESOURCE`, preventing silent overwrites. Comment creation intentionally has no client version field but updates ticket activity and participates in JPA version advancement.

The lifecycle is OPEN → IN_PROGRESS → RESOLVED → CLOSED, with the documented reopen path from RESOLVED to IN_PROGRESS. CLOSED tickets are terminal/read-only for all ticket mutations and comments.
