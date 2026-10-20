# Relay customer onboarding

Relay helps an account manager take a newly signed business customer through
information collection, document review, and account activation. Customers get a
checklist; employees see the submitted information and its history.

This portfolio demo uses fictional companies and disposable local services. It
needs no customer accounts, paid integrations, email service, or public hosting.

The current app includes customer submissions, private document downloads,
reviewer approvals/correction requests, revision history, server-side demo
sessions, and workspace/customer access checks. Activation, reminders, and the
recorded walkthrough are the next delivery stages.
See the [implementation plan](PLAN.md) for current progress.

## Try the local demo

Use Node **24.20.0**, pnpm **11.23.0**, and Docker with Compose. On this Windows
machine, Docker runs inside WSL Ubuntu. The lifecycle commands select that engine
automatically; Docker Desktop is not required.

```sh
pnpm install --frozen-lockfile
pnpm env:doctor
pnpm dev
```

Open the reported web URL, normally `http://127.0.0.1:4310`. Choose **Maya Chen**
to open Juniper Retail's checklist. Add company details and submit them for review.
Switch to **Ada Wells**, open Juniper Retail, and see the submission and its actor
in the activity history. **Owen Reed** belongs to a different customer; **Iris Park**
belongs to another workspace. Neither can access Juniper's records.

For document review, upload a synthetic PDF agreement as Maya, then choose
**Noah Ellis** to approve it or request a correction with a reason. Maya sees that
reason, can upload a replacement, and retains access to earlier file revisions.
The sample import requirement accepts UTF-8 CSV. Uploads are limited to 2 MiB.

The persona picker is local demo authentication, not production login. All names,
documents, companies, and activity are synthetic. Requests derive access from
server-side sessions rather than an actor or workspace supplied by the client.

Every development run migrates and seeds a new project-owned database. Stopping it
discards that run's data, so the next run starts from the same fixtures.

## Verify and stop

```sh
pnpm verify
pnpm env:clean
pnpm env:status
```

Verification builds the web/API, runs strict type and lint checks plus real
PostgreSQL tests, checks the built web/API connection, and removes its disposable
resources. The test database and ports are separate from an active demo.
`env:clean` also requests a graceful shutdown of this project's running demo.
After a forced terminal stop, run it again to recover recorded leftovers.

The app uses React, TypeScript, Vite, Tailwind, TanStack Query, Fastify, ArkType,
Drizzle, and PostgreSQL. Dependency versions and the database image digest are
pinned. Setup details, test diagnostics, browser installation, and resource
ownership are in [the development guide](docs/DEVELOPMENT.md).
