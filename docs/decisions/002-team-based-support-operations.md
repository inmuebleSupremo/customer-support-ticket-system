# Team-Based Support Operations

**Status:** Accepted  
**Date:** 2026-09-30

This decision record is the additive v2 decision authority for team-based support operations. It refines the v1 specifications only where it explicitly says so; all other v1 behaviour remains in force.

## Routing and ownership

- A ticket may have neither an assigned team nor an assigned agent, a team only, an agent only, or both.
- An agent-only ticket with no team, including an existing v1 ticket, remains valid.
- When a ticket has an assigned team, its assigned agent must be a current member of that team. The agent must still meet the existing v1 eligibility rule: active and in the `AGENT` role.
- AGENT and ADMIN users may route tickets to active teams. Team membership is an operational grouping rule, not a ticket-visibility permission boundary.
- AGENT visibility remains global in this increment. Tickets without a team remain in the global queue and may be individually assigned.
- A ticket may not be routed to an inactive team. A team may not be deactivated while it is assigned to an `OPEN`, `IN_PROGRESS`, or `RESOLVED` ticket. Teams are deactivated, never hard-deleted.
- If a team change would leave the current assigned agent outside the target team, the operation changes the team and clears that agent atomically. It writes both `TEAM_CHANGED` and `ASSIGNMENT_CHANGED` ticket-history entries.
- CLOSED tickets remain terminal and read-only, including for team-routing changes.

## Team membership

- Team membership uses a simple join table in this increment; no `TeamMembership` entity, membership roles, or membership-history model is introduced.
- Removing an agent from a team is rejected while that agent is assigned to an `OPEN`, `IN_PROGRESS`, or `RESOLVED` ticket assigned to that same team. Administrators must explicitly reassign, unassign, or route those tickets first.
- Team administration and membership management are ADMIN-only. Customers cannot browse teams or memberships.
- Customers may see the assigned team name on their own ticket, read-only.

## Current-user team lookup

`GET /api/v1/users/me/teams` is available to AGENT and ADMIN users. It returns only active team summaries for teams of which the authenticated user is currently a member. It does not expose full membership, and CUSTOMER users are denied.

## Agent deactivation

The v1 account-deactivation invariant is strengthened: an AGENT cannot be deactivated while individually assigned to any non-CLOSED ticket (`OPEN`, `IN_PROGRESS`, or `RESOLVED`). CLOSED tickets do not block deactivation. The system must not automatically unassign tickets during deactivation; an administrator must explicitly reassign or unassign them first so ticket audit history remains accurate.

## Audit and concurrency invariants

- `TEAM_CHANGED` is an immutable `TicketHistory` event, recording the prior and new team values, actor, and timestamp.
- Ticket routing and any automatic incompatible-assignment removal occur in the same transaction and participate in the ticket's existing optimistic locking.
- Membership removal and ticket assignment/routing must be coordinated so concurrent operations cannot leave a team-routed ticket assigned to a non-member.

## Explicitly out of scope

- Automatic or AI routing, routing rules, and classification.
- Team-scoped authorization, per-team roles, leads, schedules, capacity, or workload balancing.
- Membership history or a separate team-administration audit subsystem.
- SLAs, notifications, escalations, reporting, dashboards, departments, customer organizations, multi-tenancy, attachments, and bulk reassignment.
