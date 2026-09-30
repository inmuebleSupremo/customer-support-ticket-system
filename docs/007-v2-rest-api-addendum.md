# ResolveDesk v2 REST API Addendum — Team-Based Support Operations

This document is additive to the historical v1 contract in [003-REST-api-contract.txt](003-REST-api-contract.txt). It records the implemented v2 endpoints and additive DTO/query changes; it does not replace or rewrite the v1 contract.

## Team representations

Ticket summary and detail responses add nullable `assignedTeam`:

```json
{
  "assignedTeam": { "id": 12, "name": "Technical Support", "active": true }
}
```

`assignedTeam` is `null` for an unrouted ticket. Existing fields and endpoints remain available. A team summary is `{ id, name, active }`; administrative team detail additionally returns `members`, `createdAt`, and `updatedAt`. Team members are `{ id, displayName, email, active }`.

`GET /api/v1/tickets/{id}/history` may return a `TEAM_CHANGED` event with `fieldName: "assignedTeam"`. Its existing `oldDisplayValue` and `newDisplayValue` fields contain human-readable prior and new team names.

## Team and membership endpoints

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/v1/teams` | AGENT, ADMIN | Returns active team summaries, ordered by name. `includeInactive=true` returns active and inactive teams for ADMIN only; AGENT requests for inactive teams are denied. |
| `GET /api/v1/teams/{id}` | ADMIN | Returns administrative detail and current members. |
| `POST /api/v1/teams` | ADMIN | Creates a team from `{ "name": "..." }`; returns `201 Created`. |
| `PATCH /api/v1/teams/{id}/name` | ADMIN | Renames a team from `{ "name": "..." }`. |
| `PATCH /api/v1/teams/{id}/active` | ADMIN | Activates or deactivates a team from `{ "active": true|false }`. |
| `PUT /api/v1/teams/{id}/members/{userId}` | ADMIN | Adds an AGENT as a current member. |
| `DELETE /api/v1/teams/{id}/members/{userId}` | ADMIN | Removes a current member, subject to the non-CLOSED-ticket safeguard. |
| `GET /api/v1/users/me/teams` | AGENT, ADMIN | Returns active team summaries for the authenticated user's current memberships only. |

CUSTOMER users cannot use team administration, team listing, or current-user-team lookup endpoints.
They can receive the read-only `assignedTeam` summary on tickets they are otherwise authorized to read.

## Ticket routing and assignment

`PATCH /api/v1/tickets/{id}/team` is available to AGENT and ADMIN users. It accepts the ticket's current optimistic-lock version and a nullable team id:

```json
{ "teamId": 12, "version": 4 }
```

Set `teamId` to `null` to clear routing. The response contains the ticket id/reference, `assignedTeam`, current `assignedAgent`, `updatedAt`, and updated `version`.

Only active teams can receive routing. CLOSED tickets cannot be routed. If selecting a team would make the existing assignee ineligible, routing succeeds by clearing that assignee atomically and recording both `TEAM_CHANGED` and `ASSIGNMENT_CHANGED` history events.

`PATCH /api/v1/tickets/{id}/assignee` remains unchanged except for team eligibility: the candidate must be an active AGENT and, when the ticket has an assigned team, a current member of that team.

`GET /api/v1/agents` remains available to AGENT and ADMIN users. The optional `teamId` parameter returns only active AGENT users who are current members of that team; without it, the existing active-agent result remains unchanged. The response shape remains `{ id, displayName, email }`.

## Support Queue query additions

The global AGENT/ADMIN queue remains `GET /api/v1/tickets`. These optional filters compose with existing status, priority, assignee, search, sorting, and pagination filters:

| Parameter | Meaning |
| --- | --- |
| `teamId={positive id}` | Tickets assigned to that team. |
| `unassignedTeam=true` | Tickets with no assigned team (unrouted). |
| `myTeams=true` | Tickets assigned to any active team of which the authenticated user is a current member. |

`teamId`, `unassignedTeam=true`, and `myTeams=true` are mutually exclusive. They do not change authorization: the staff queue is still global. Filtering, sorting, totals, and pagination occur in the database. The existing `unassigned=true` parameter continues to mean no individual assignee, not no team.

## Authorization and invariants

- Team membership is an operational eligibility rule, not a team-scoped ticket-visibility rule.
- A ticket can be team-only, agent-only, both, or neither. When it has both, the agent must be an active AGENT and a current member of the assigned team.
- An inactive team cannot own a non-CLOSED ticket. Deactivation is rejected while the team owns an OPEN, IN_PROGRESS, or RESOLVED ticket.
- Removing a member is rejected while that agent owns an OPEN, IN_PROGRESS, or RESOLVED ticket assigned to that team.
- An AGENT cannot be deactivated or changed to another role while they own any non-CLOSED ticket. Moving away from AGENT removes current team memberships.
- Ticket routing and assignment use the ticket version and return stale-resource feedback rather than silently overwriting a concurrent ticket change. Eligibility-changing administration uses database locks to serialize with routing and assignment.

## Relevant Problem Details codes

The API continues to return RFC 9457-style Problem Details with a stable `code` field. Important v2 codes include:

| Code | Meaning |
| --- | --- |
| `TEAM_NAME_ALREADY_EXISTS` | A create or rename would duplicate a team name. |
| `INVALID_TEAM_MEMBER` | The requested member is not eligible for team membership. |
| `TEAM_HAS_ACTIVE_TICKETS` | A team cannot be deactivated while it owns a non-CLOSED ticket. |
| `TEAM_MEMBER_HAS_ACTIVE_TICKETS` | A member cannot be removed while owning a non-CLOSED ticket routed to that team. |
| `INVALID_TEAM` | A requested routing team does not exist or is inactive. |
| `ASSIGNEE_NOT_IN_TEAM` | The requested assignee is not a current member of the ticket's team. |
| `INVALID_ASSIGNEE` | The requested assignee is not an active AGENT. |
| `AGENT_HAS_ACTIVE_TICKETS` | An AGENT cannot be deactivated or moved away from the AGENT role while assigned non-CLOSED tickets. |
| `STALE_RESOURCE` | The supplied ticket version is stale. |
| `TICKET_CLOSED` | A ticket mutation was attempted on a terminal CLOSED ticket. |
| `VALIDATION_ERROR` | A query or request body is invalid, including incompatible queue filter combinations. |
