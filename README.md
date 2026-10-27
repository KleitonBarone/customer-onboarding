# Relay customer onboarding

Relay helps an account manager take a newly signed retailer from missing
information to an active account. Customers submit a four-item checklist;
reviewers explain corrections; account managers see who needs to act next.

![Employee queue showing statuses, owners, ages, and next actions](docs/media/queue.png)

[Screenshots](docs/SCREENSHOTS.md) ·
[Engineering case study](docs/CASE_STUDY.md)

## What works

The employee queue supports status, owner, and company filters. The customer
portal collects company details, a PDF agreement, a CSV import, and a launch
contact. Replacements create immutable revisions and require fresh review.
Earlier documents, decisions, correction reasons, and actors remain visible.

Activation requires every mandatory current revision to be approved. Active
accounts reject edits until an account manager explicitly reopens onboarding
with a reason. Server-side sessions scope employees to their provider workspace
and customers to assigned accounts, including historical file downloads.

A durable PostgreSQL outbox delivers customer-action reminders to a local inbox.
Each onboarding receives at most one reminder per UTC day. A persistent workspace
demo clock makes the next window observable without waiting or expiring sessions.

## Try the browser demo

Use Node **24.20.0** and pnpm **11.23.0**:

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open `http://127.0.0.1:4312`. Each tab gets independent fictional data; changes and
uploads stay in memory. Refresh or **Reset demo** restores the examples.
The [Vercel deployment guide](docs/DEMO.md) covers the static build and hosting.

## Run the full application

The full application also needs Docker with Compose. Windows uses Docker Engine
in WSL Ubuntu; Linux uses its native Docker CLI.

```sh
pnpm env:doctor
pnpm dev
```

Open the reported URL, normally `http://127.0.0.1:4310`. Use **View as** to choose
**Account manager**, **Reviewer**, or **Customer**. Customer view offers company
names and defaults to the account you were viewing. Juniper's agreement needs
correction: upload `fixtures/service-agreement.pdf` as Customer, approve it as
Reviewer, then activate it as Account manager. The other three items are approved.
The fixtures also cover Beacon (not started), Atlas (waiting for review), Cedar
(ready), and Lumen (active).

Switching views keeps the current account open. **Back to account manager** returns
customers to the queue. Account managers can advance the demo date in the inbox
to generate another reminder. The processor checks every five seconds; no real
email is sent. API tests also verify customer and provider isolation.

## Verify, reset, and stop

```sh
pnpm browser:install
pnpm verify
pnpm env:clean
pnpm env:status
```

Verification creates separate database, storage, and ports; applies migrations and
fixtures; runs lint, strict types, API/domain and environment regression tests,
builds, and two Chromium journeys; then removes its services. CI runs the same
checks on Linux, plus `pnpm verify:demo` for the static demo.

Every development session starts with fresh disposable data. In a second
terminal, `pnpm demo:reset` verifies the recorded process and database identity
before recreating that stack. It becomes the new foreground session.
`env:clean` stops the demo gracefully and recovers recorded leftovers after a
forced stop. Follow the [development guide](docs/DEVELOPMENT.md) for ownership,
ports, migrations, and diagnostics.

## Design and limits

React, Vite, Tailwind, TanStack Query, Fastify, ArkType, Drizzle, and PostgreSQL
form one small application. Dependencies and the database image digest are pinned.

All people, companies, files, dates, and activity are synthetic. The view switcher
is local demo authentication. PDF/CSV uploads are private and limited to 2 MiB;
malware scanning, real identity, and external email are outside this demo.
The browser build simulates the workflow; the full application enforces access
and transactions on the server. Verification establishes these scenarios; it
provides no customer adoption or business-impact evidence.

See [architecture](docs/ARCHITECTURE.md) for the access model, workflow transactions,
and storage tradeoffs, and [verification coverage](docs/DEVELOPMENT.md#verification-coverage)
for the checks behind the demo.

## License

[MIT](LICENSE), copyright 2026 Kleiton Barone.
