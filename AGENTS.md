# ResolveDesk Repository Instructions

## Specifications and decisions

- The five numbered specification documents in `docs/` are the primary project specifications.
- `docs/decisions/` contains later explicit decisions that resolve or refine specification ambiguities.
- When a decision record explicitly resolves a conflict, that record governs.
- Do not expand MVP scope without explicit approval.
- Do not silently change documented API or business behaviour. If a genuine contradiction or required contract change is discovered, stop the affected work and call it out.

## Backend and domain rules

- Keep controllers thin; business rules belong in service/domain logic.
- JPA entities must never be exposed directly through the REST API. DTOs define the API boundary.
- Backend authorization is authoritative. Do not trust ownership or actor values supplied by clients; derive them from the authenticated identity.
- Flyway owns the database schema. Hibernate must not silently create or update the production schema.
- Tickets, comments, and ticket history are never hard-deleted in MVP v1. Comments and ticket history are immutable.
- Ticket mutations must preserve required audit history transactionally and respect Ticket optimistic locking.
- CLOSED tickets are terminal and read-only.
- Only active users with role AGENT may receive ticket assignments.

## Engineering expectations

- Add meaningful automated tests alongside business functionality.
- Avoid unnecessary architectural complexity and dependencies.

## Standard build and test commands

To be established during Phase 1. Do not invent or run application build, test, database, or frontend commands before the relevant project scaffolding exists.
