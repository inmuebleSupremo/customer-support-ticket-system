# MVP Clarifications

**Status:** Accepted  
**Date:** 2026-09-29

This record resolves the ambiguities identified during pre-implementation planning. It governs where it explicitly resolves or refines the numbered project specifications.

## Assignable roles

Only an active user with the `AGENT` role may be assigned to a ticket. `ADMIN` users may operate on tickets but are not valid assignees and are excluded from `GET /api/v1/agents`.

**Rationale:** Keeps ticket ownership within the support-agent role while retaining full administrative operational access.

**Consequences:** Assignment and agent-lookup logic must require both `active = true` and `role = AGENT`.

## Bootstrap administrator

The first administrator is provisioned through environment-driven bootstrap configuration. There is no public ADMIN-creation endpoint, no committed administrator credentials, and no hard-coded administrator password.

**Rationale:** Enables initial administration without weakening the self-registration rule that creates only CUSTOMER users.

**Consequences:** The authentication phase must define a safe local and deployed bootstrap process using environment-provided configuration.

## Closed tickets

`CLOSED` is terminal and read-only. A closed ticket cannot change status or priority, be assigned, reassigned, or unassigned, or receive comments. Attempted business mutations return `409 Conflict` with code `TICKET_CLOSED` where applicable.

**Rationale:** Preserves finality and historical integrity for completed support records.

**Consequences:** Every ticket-mutation service must check for `CLOSED` before changing state and preserve the ticket unchanged on rejection.

## Role changes for assigned agents

An AGENT cannot be changed to another role while assigned to any ticket whose status is `OPEN`, `IN_PROGRESS`, or `RESOLVED`. The role change returns a meaningful `409 Conflict` until each such ticket is explicitly reassigned or unassigned. CLOSED tickets do not block the change and may retain their historical assignment.

**Rationale:** Prevents active or unresolved work from being left assigned to a user who is no longer an agent, while retaining historical accountability.

**Consequences:** Role-change validation must query all non-closed ticket assignments. Reassignment and unassignment remain separate audited ticket operations.
