# Relay customer onboarding

Relay helps an account manager take a newly signed business customer through
information collection, document review, and account activation. Customers get a
checklist; employees see the submitted information and its history.

This portfolio demo uses fictional companies and disposable local services. It
needs no customer accounts, paid integrations, email service, or public hosting.

The current app includes customer submissions, private document downloads,
reviewer approvals/correction requests, revision history, server-side demo
sessions, workspace/customer access checks, and transactional activation/reopening.
The employee queue includes status, owner, age, next action, and bounded filters.
The local inbox demonstrates durable reminders without an email service.
The recorded walkthrough is the next stage.
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
to open Juniper Retail's checklist. Its agreement needs a correction. Upload
`fixtures/service-agreement.pdf`, switch to **Noah Ellis**, and approve the new
revision. **Ada Wells** can then activate the account. Earlier revisions, review
reasons, and actors remain in the history. **Owen Reed** belongs to a different customer; **Iris Park**
belongs to another workspace. Neither can access Juniper's records.

The queue also includes Beacon (not started), Atlas (waiting for review), Cedar
(ready to activate), and Lumen (active). Filter by status or account manager,
or search by company. PDF agreements and UTF-8 CSV imports are limited to 2 MiB;
both formats have synthetic examples in `fixtures/`.
After Noah approves every mandatory current submission, Ada can activate the
account. Active accounts reject changes until Ada explicitly reopens onboarding
with a reason. A replacement then needs fresh review before reactivation.

The persona picker is local demo authentication, not production login. All names,
documents, companies, and activity are synthetic. Requests derive access from
server-side sessions rather than an actor or workspace supplied by the client.

Every development run migrates and seeds a new project-owned database. Stopping it
discards that run's data, so the next run starts from the same fixtures.
To restart fixtures during a demo, run `pnpm demo:reset` in a second terminal.
It verifies the recorded demo process, database port, name, and marker, then
recreates only that disposable stack. The reset command becomes the new foreground
session; choose a persona again after it reports ready.

## Verify and stop

Juniper initially receives one reminder to correct its agreement. In the inbox,
Ada can advance Northstar's demo date by 24 hours to create the next day's reminder.
The processor checks every five seconds and persists pending work across API
restarts. Replays produce one message per onboarding and UTC day. Draft, ready,
active, and reviewer-only waiting records do not receive customer reminders.
Maya sees Juniper's inbox; Owen and the other provider cannot read it. Workspace
demo dates are independent and do not change real session expiry.

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
