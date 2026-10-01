# Local demo data

`scripts/seed-demo-data.ps1` creates the repeatable fictional dataset used for local ResolveDesk portfolio screenshots. It uses only the public ResolveDesk HTTP API: it does not connect to MySQL, modify Flyway migrations, change `.env`, or delete Docker volumes.

## Reset and seed

This is deliberately a destructive local reset. It removes the Compose MySQL volume, so use it only when discarding local ResolveDesk data is intended:

```powershell
docker compose down -v
docker compose up --build
```

Before starting the stack, configure the bootstrap administrator values in your local, ignored `.env` as the requested demo administrator:

```text
RESOLVEDESK_BOOTSTRAP_ADMIN_EMAIL=alex.morgan@example.test
RESOLVEDESK_BOOTSTRAP_ADMIN_FIRST_NAME=Alex
RESOLVEDESK_BOOTSTRAP_ADMIN_LAST_NAME=Morgan
```

Choose any local bootstrap password that satisfies the existing password policy; do not add it to a tracked file. Once the application is reachable at `http://localhost:8080`, run:

```powershell
.\scripts\seed-demo-data.ps1
```

The script prompts securely for the bootstrap password. It also accepts `-BootstrapAdminPassword` as a `SecureString`, or reads `RESOLVEDESK_BOOTSTRAP_ADMIN_PASSWORD` from the current PowerShell process when set. For example:

```powershell
.\scripts\seed-demo-data.ps1 -BootstrapAdminPassword (Read-Host -AsSecureString)
```

The default target is `http://localhost:8080/api/v1`. Only loopback targets (`localhost`, `127.0.0.1`, or `::1`) are accepted unless `-AllowRemoteTarget` is supplied explicitly. This override exists only for an intentional, controlled use; the script is designed for local demo data.

## Accounts

The existing bootstrap administrator is the requested demo administrator:

```text
Alex Morgan — alex.morgan@example.test
```

The script creates the four fictional agents and four fictional customers from the demo brief. Every non-admin account uses this local-only shared password:

```text
ResolveDeskDemo123!
```

The script prints the complete account list and the shared password on successful completion. It never prints or stores the bootstrap administrator password.

## Safety and behavior

The script logs in through server-managed sessions and calls `GET /auth/csrf` before every state-changing request, supplying the returned CSRF header while retaining the session and CSRF cookies in a PowerShell web session.

Before creating anything, it logs in as the bootstrap administrator and requires exactly one user (that administrator), zero tickets, and zero teams. It also requires that bootstrap identity to be Alex Morgan at `alex.morgan@example.test`. If any check fails, it stops before any write, rather than duplicating a partial or incompatible dataset.

Tickets are created by their customer accounts. The administrator then uses the real routing, assignment, priority, and status endpoints with the current optimistic-lock version supplied by the API. Closed tickets are moved through `OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED`; comments are added before the final close. This leaves the normal immutable ticket history, including creation, team routing, assignment, priority changes where needed, and lifecycle events. SUP-1 receives the specified four-message showcase conversation.

There is no public administrator-creation API in ResolveDesk, so the script cannot create or rename an administrator through the API. That is why the fresh stack's bootstrap account must be configured as Alex Morgan before seeding.
