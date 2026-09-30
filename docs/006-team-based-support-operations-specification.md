# ResolveDesk v2 — Team-Based Support Operations Specification

This is an additive v2 design/API specification. The numbered v1 specifications and accepted decision records remain authoritative except where [decision 002](decisions/002-team-based-support-operations.md) explicitly refines behaviour.

## Domain model

`Team` is an operational group with `id`, unique `name`, `active`, `createdAt`, and `updatedAt`. A team has many current members through a simple `team_members` join table; an AGENT may belong to many teams. The join table has a composite primary key of `team_id, user_id` and a reverse user lookup index.

`Ticket.assignedTeam` is a nullable many-to-one association to `Team`, separate from nullable `Ticket.assignedAgent`. Ticket response DTOs add an additive `assignedTeam` field containing `{ id, name }` or `null`. New customer tickets and all migrated v1 tickets have no team.

Only active AGENT users remain assignable. Where a ticket has a team, assignment additionally requires current membership in that team. ADMIN users retain ticket-operating authority but remain ineligible as individual assignees.

## Ticket audit

Add `TEAM_CHANGED` to `TicketEventType`. It uses `fieldName: assignedTeam`; immutable old/new values identify the prior and new teams, and response mapping supplies display values. When routing clears an incompatible assignee, one `TEAM_CHANGED` event and one existing `ASSIGNMENT_CHANGED` event are written in the same ticket transaction.

## REST additions

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/teams` | AGENT, ADMIN | Active team summaries for routing/filtering. |
| `GET /api/v1/teams/{id}` | ADMIN | Administrative team detail, including members. |
| `POST /api/v1/teams` | ADMIN | Create a team. |
| `PATCH /api/v1/teams/{id}/name` | ADMIN | Rename a team. |
| `PATCH /api/v1/teams/{id}/active` | ADMIN | Activate/deactivate a team, subject to active-ticket validation. |
| `PUT /api/v1/teams/{id}/members/{userId}` | ADMIN | Add a current member. |
| `DELETE /api/v1/teams/{id}/members/{userId}` | ADMIN | Remove a current member, subject to ticket-assignment validation. |
| `GET /api/v1/users/me/teams` | AGENT, ADMIN | Active summaries for the authenticated user's memberships only. |
| `PATCH /api/v1/tickets/{id}/team` | AGENT, ADMIN | Set or clear `assignedTeam`; request includes nullable `teamId` and required ticket `version`. |

`GET /api/v1/tickets` adds optional `teamId` and `unassignedTeam` query parameters. `teamId` and `unassignedTeam=true` are mutually exclusive. The existing `unassigned` parameter continues to mean that no individual agent is assigned.

Existing routes are neither removed nor renamed. Existing ticket responses gain only the additive `assignedTeam` field. Customers cannot call team or current-user-team endpoints, but may receive the assigned-team summary for tickets they are authorized to read.

## Migration plan

Do not alter V1–V4. Flyway migrations evolve an existing v1 database as follows:

1. `V5__create_teams_and_team_members.sql` creates `teams`, `team_members`, foreign keys, name uniqueness, and membership indexes.
2. `V6__add_assigned_team_to_tickets.sql` adds nullable `tickets.assigned_team_id`, a restrictive foreign key, and a team queue index such as `(assigned_team_id, status)`.
3. `V7__add_team_changed_ticket_history_event.sql` expands the V3 ticket-history event-type constraint to allow `TEAM_CHANGED`.

Existing users, tickets, comments, and history require no data rewrite. Existing tickets receive `assigned_team_id = NULL` and retain all v1 semantics.

## Queue and frontend contract

The support queue remains global for AGENT and ADMIN users. It gains team and no-team filters plus a frontend “My teams” convenience view backed by `GET /api/v1/users/me/teams`; this is not an authorization restriction. Queue and ticket-detail views show the current team. Ticket detail supports staff routing and restricts individual-assignee choices to current team members when a team is selected. An ADMIN-only team administration workspace manages teams and membership.

## Required verification

Tests must cover team administration authorization; membership eligibility and removal blockers; team routing; team/agent compatibility; automatic clearing and both history entries; team deactivation blockers; current-user-team access; queue filters; customer read-only team visibility; v1 ticket compatibility; optimistic-locking conflicts; and concurrent membership/routing safety. Migration tests must prove upgrade compatibility from a populated V4-shaped schema.
