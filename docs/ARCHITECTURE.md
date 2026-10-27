# Application boundaries

Relay is a React/Vite client, one Fastify API, PostgreSQL, and a private local
upload directory. TanStack Query handles browser fetching; ArkType validates
untrusted inputs and shared response contracts; Drizzle supplies typed queries
and committed migrations. There is no broker or external service dependency.

## Identity and access

The demo view switcher maps roles and companies to seeded memberships and
exchanges a membership ID for an opaque HttpOnly cookie.
Only its hash is stored. Every protected request resolves the session to a user,
role, and provider workspace. Employees see their workspace; customers also need
an explicit customer-account assignment. Detail and historical file reads use the
same scope. Unknown and inaccessible records return the same 404 response.

The switcher is available in explicit local demo mode. It is unsuitable for public
authentication: anyone using the local app can choose another persona.
Production identity and hosting of the full API require separate work.

## Workflow transactions

Requirements are missing, submitted, changes requested, or approved. Revisions
and review decisions are immutable. A replacement changes the current revision,
resets review state, and increments versions. Readiness is derived from current
mandatory approvals, never a separately maintained ready flag.

Submissions, reviews, activation, and reopening lock the onboarding row before
checking the current versions and writing state plus actor-derived activity.
This serializes a replacement racing activation. Stale requests receive 409.
Active accounts reject changes; a manager must reopen them with a reason.

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant PostgreSQL
  Client->>API: Current version + requested action
  API->>PostgreSQL: Resolve session and scoped account
  API->>PostgreSQL: BEGIN; lock onboarding
  API->>PostgreSQL: Check version, role and current requirements
  API->>PostgreSQL: Write revision/review/state and activity; COMMIT
  API-->>Client: Success, or explicit conflict/denial
```

## Files and reminders

PDF/CSV inputs are capped at 2 MiB, checked for the expected format, and stored
under opaque identifiers. Downloads authorize through the API before reading
bytes. Failed submissions remove their newly written file. PostgreSQL and the
filesystem cannot commit atomically; a process crash between file creation and
SQL commit can leave an orphan until disposable-run cleanup. There is no malware
scanner. A production storage lifecycle would need reconciliation and scanning.

The API enqueues customer-action reminders for started, inactive onboardings with
missing or correction-requested mandatory requirements. Reviewer-only waiting,
draft, ready, and active records are excluded. The unique key is onboarding,
reminder kind, and UTC date. Inbox delivery and acknowledgement commit together;
workers lock pending rows with SKIP LOCKED. This deduplicates local SQL inbox
delivery. External email would require a provider-specific idempotency policy.

Each workspace has a persistent demo clock. Managers advance their own workspace
by exactly 24 hours. Session expiry and delivery timestamps use real wall time.
The API processes startup work and checks every five seconds, then closes the
timer on shutdown. The employee inbox shows accessible workspace messages;
customer inboxes show assigned accounts, capped at the latest 50 messages.

## Runtime and verification

See [development](DEVELOPMENT.md) for process ownership, WSL keep-alive, explicit
Docker subnets, recovery, and bounded diagnostics. Each verification migrates an
empty PostgreSQL database, seeds synthetic data, runs API/rule tests, builds the
app, exercises Chromium against the built services, and tears down. The tests
establish correctness for these cases, not throughput or production readiness.

## Browser demo

The [portfolio build](DEMO.md) serves the same UI with a browser data adapter.
Each tab has an independent memory store, shared fictional fixtures and shared
readiness/next-action rules. User files use object URLs within that tab; refresh
or reset discards state. Role switching and workflow transitions are simulated.
The static build contains no API runtime or database connection. The full app's
authorization and transaction tests continue to run separately.
