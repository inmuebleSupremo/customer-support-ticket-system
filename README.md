# ResolveDesk

ResolveDesk is a full-stack support ticket application built as a portfolio project. It gives customers a clear way to raise and follow support issues while giving agents and administrators a controlled operational workspace.

## Problem and MVP

Support requests often lose context when ownership, status, and customer communication live in separate places. ResolveDesk keeps the ticket, its immutable activity history, and its conversation together while enforcing role-appropriate access.

The implemented v2 release covers ticket intake, lifecycle management, and team-based support operations. It intentionally excludes notifications, attachments, SLA/reporting features, real-time updates, OAuth, and external integrations.

## Key features

- Customer self-registration and session-based authentication with CSRF protection.
- Customer ticket creation, private workspace, activity history, and conversation.
- Agent and administrator global support queue with server-side status, priority, assignee, search, team, unrouted, and My Teams filters; sorting and pagination remain server-side.
- Team-based ticket routing and team-aware individual assignment, with immutable routing and assignment history.
- Optimistic locking for ticket mutations, eligibility-changing concurrency protection, and terminal, read-only closed tickets.
- Administrator user search/filtering, role management, activation controls, final-admin protection, and Team Administration.
- Team Administration for creating, renaming, activating/deactivating, and managing AGENT membership in support teams.

## Roles

| Role | Capabilities |
| --- | --- |
| CUSTOMER | Registers, creates tickets, sees only owned tickets, comments, and reopens resolved tickets. |
| AGENT | Views the global support queue, routes tickets to active teams, assigns eligible active agents, changes status/priority, and comments. |
| ADMIN | Has queue access plus user and team administration. ADMIN users are not ticket assignees. |

Only active AGENT users can receive assignments. When a ticket has an assigned team, its assignee must also be a current member of that team. Inactive accounts cannot authenticate.

## Technology stack

- Backend: Java 21, Spring Boot, Spring Web, Spring Security, Spring Data JPA, Bean Validation, Flyway, MySQL, springdoc/OpenAPI.
- Frontend: React, TypeScript, React Router, Tailwind CSS, Vite.
- Testing: JUnit, Spring Boot Test, Spring Security Test, H2/Flyway integration tests, real MySQL 8 Testcontainers migration tests, Vitest, Testing Library.
- Delivery: Docker Compose, Nginx, GitHub Actions.

## Architecture

The React client talks to the Spring Boot REST API. In Docker Compose, Nginx serves the static client and proxies same-origin `/api` requests to the backend; the backend owns all business authorization and persists to MySQL. Flyway is the sole schema owner and Hibernate validates rather than creates or updates production tables.

The backend is organized by feature (`auth`, `users`, `teams`, `tickets`, `tickets/comments`, and `tickets/history`). Controllers accept/return DTOs and delegate to services; services enforce domain and authorization rules; repositories execute persistence queries. See [architecture.md](docs/architecture.md) for the implemented design.

## Ticket lifecycle

```text
OPEN → IN_PROGRESS → RESOLVED → CLOSED
          ↑              │
          └──────────────┘
```

Customers may reopen only a resolved ticket to `IN_PROGRESS`. CLOSED is terminal: status, priority, assignment, and comments cannot change. Ticket creation, assignment, status, and priority changes create immutable history entries; comments are themselves immutable audit records.

## Local setup

Prerequisites for non-Docker development are Java 21, Maven, Node.js 22, and MySQL 8+. Copy `.env.example` to `.env`, replace the placeholder credentials, and expose those values in your shell before starting the backend directly. `.env` is ignored by Git and must remain local. The frontend uses the API base configured by `VITE_API_BASE_URL`; leave it blank when using the Compose proxy.

Run the verified commands from the repository root:

```bash
mvn -f backend/pom.xml test
mvn -f backend/pom.xml package
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
```

For local frontend development, install dependencies with `npm --prefix frontend ci` and run `npm --prefix frontend run dev`.

## Docker

The normal local startup flow is intentionally explicit:

```bash
# macOS/Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Edit `.env`: replace every `change-me` password and set the bootstrap-admin values for a new database. Then run:

```bash
docker compose config
docker compose up --build
```

Compose reads `.env` automatically. It now fails during configuration if the MySQL database name, application username/password, or MySQL root password is missing, rather than passing blank values to MySQL or Spring Boot. The application datasource always uses `RESOLVEDESK_DB_USERNAME` and `RESOLVEDESK_DB_PASSWORD`; it does not use the MySQL root account.

The frontend is available at `http://localhost:5173` by default and the backend at `http://localhost:8080`. Compose starts MySQL first, waits for its health check, then starts the backend; Flyway applies V1–V7 when the database is empty.

MySQL initialization values are used only when the named Docker volume is first created. To preserve existing local data, keep the same database credentials and use `docker compose up --build`. If the existing volume was initialized with different credentials, either restore the original values in `.env` or intentionally reset local development data with:

```bash
docker compose down -v
docker compose up --build
```

`docker compose down -v` permanently removes the local ResolveDesk MySQL data volume; it is never required for normal startup and should only be used when discarding local development data is intended.

## Environment configuration

`.env.example` documents all local settings: MySQL database/name/ports, backend credentials and JDBC URL, environment-provided bootstrap-admin values, local ports, and the frontend API base URL. It contains placeholders only; copy it to the ignored `.env` file before using Docker Compose. There is no public administrator-creation endpoint and no committed credential.

## API and OpenAPI

The REST API is rooted at `/api/v1`. The generated OpenAPI document is available at `/api-docs`, and Swagger UI is available at `/swagger-ui`. The historical v1 API contract is [003-REST-api-contract.txt](docs/003-REST-api-contract.txt); implemented team-based additions are recorded in the [v2 REST API addendum](docs/007-v2-rest-api-addendum.md). API behavior, request/response DTOs, status codes, and Problem Details errors are defined by the numbered specification documents in `docs/`.

## Testing strategy

Backend integration tests cover authentication, Flyway validation, customer ownership concealment, queue queries, routing, team-aware assignment, membership and administration safeguards, concurrency invariants, comments, and the complete workflow. Focused Testcontainers tests run Flyway V1–V7 against MySQL 8, including a representative V4-to-V7 upgrade and Hibernate schema validation. Frontend tests cover identity, protected routes, customer workspace, the agent queue and its team filters, ticket workflows, conversation, priority, user administration, and team administration. GitHub Actions runs all backend and frontend verification commands on pushes and pull requests.

## Project structure

```text
backend/                  Spring Boot API, Flyway migrations, backend tests
frontend/                 React application, API clients, component tests
docs/                     Authoritative specifications, decisions, architecture notes
.github/workflows/        Continuous integration
docker-compose.yaml       MySQL + backend + frontend local stack
```

## Important engineering decisions

- Session authentication remains server-authoritative; actor and ownership data are never taken from client input.
- JPA entities never cross the REST boundary; DTOs define the API.
- Flyway controls schema evolution; production Hibernate DDL mode is `validate`.
- Ticket workflow mutations are transactional, version-aware, and retain required audit history; routing records `TEAM_CHANGED` and atomically clears an incompatible assignee.
- Tickets, comments, and history are never hard-deleted in the MVP.
- The active final ADMIN cannot be demoted or deactivated. An AGENT with any non-CLOSED assignment cannot be demoted or deactivated; role changes also remove team memberships.
- A team cannot be deactivated while it owns a non-CLOSED ticket, and a member cannot be removed while they own a non-CLOSED ticket routed to that team. Pessimistic eligibility locks serialize these checks with routing and assignment.

## Future enhancements

Potential post-MVP work includes notifications, attachments, SLAs/reporting, real-time updates, and integrations. These are deliberately outside the implemented scope.
