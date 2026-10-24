# Local development and verification

Run commands from the repository root with Node 24.20.0 and pnpm 11.23.0.
`pnpm install --frozen-lockfile` installs the pinned workspace dependencies.
`pnpm env:doctor` checks Docker/Compose and reports the demo ports. Windows uses
the existing Docker Engine inside WSL Ubuntu; Linux uses its native Docker CLI.

## Environment lifecycle

`pnpm dev` provisions a unique Compose project and disposable PostgreSQL volume,
applies committed Drizzle migrations, loads deterministic synthetic fixtures,
starts the API and web app, and waits for readiness. Default local ports are
4310 for the web app, 4311 for the API, and 55431 for PostgreSQL. Override them
with `UI_PORT`, `API_PORT`, and `DB_PORT` environment variables when needed.

The development session runs in the foreground. Use a second terminal for
`pnpm env:clean` to stop it gracefully. Standard process signals run cleanup when
the host delivers them. A forced terminal/process-tree stop can prevent the
cleanup handler from running; `pnpm env:clean` recovers recorded orphan resources
on the next invocation. `pnpm env:status` reports remaining project containers and
run manifests. Cleanup refuses an unrelated live owner or a verification still
in progress.

API and shared TypeScript source changes restart the directly owned API process
after a short debounce. The run keeps its database, uploads, ports and sessions.
Watchers close during shutdown. Setup commands may exit successfully; API, web,
the database monitor and WSL keep-alive processes are monitored as services.
A recorded `docker wait` process watches the exact database container after
startup. A database exit or unexpected monitor/service exit, including code 0,
tears down the run. Invalid backend source that cannot restart also fails the
run with diagnostics.

On Windows, a recorded WSL `sleep` process keeps the distro active while the
database is needed. Cleanup stops it after removing the run's database resources.
The runner selects an explicit unused Docker subnet, so exhausted automatic
address pools do not require pruning other projects' networks or changing the
daemon. It never shuts down WSL.

`pnpm verify` uses independent available ports and a fresh database. It applies
migrations/seeds, runs `pnpm check`, starts the built API and Vite preview, verifies
the web/API proxy, and tears down in `finally`. `pnpm check` runs lint, strict
type checking, PostgreSQL integration tests, and builds. Tests require the
connection injected by the runner; use `verify` for a complete run.

Preparation, API startup, and all database test entry points verify the live run
owner, manifest, exact database URL, and recorded Docker container/project/port
before connecting. Database tests additionally require verification mode, so
`pnpm test` cannot write to an arbitrary inherited `DATABASE_URL` or the interactive
demo. `pnpm test:unit` runs the ownership and service-exit regressions independently
of Docker and PostgreSQL; `pnpm check` includes them before database tests.

The runner records identities and task-owned paths in `.local/runs/<run-id>/`.
API and web processes are launched directly so their recorded identities survive
wrapper exits. Cleanup checks process start times before termination and verifies
deletion paths stay inside the task workspace. It removes disposable containers,
volumes, networks, and uploads, without touching other projects or shared caches.

## Browser inspection and diagnostics

`pnpm demo:reset` checks the single recorded live development run, process start
identity, Compose-published database port, database name, and demo marker before
recreating its stack at the same ports. It accepts no arbitrary database URL.
The command stays in the foreground as the replacement development session.
It restores all five workflow scenarios and invalidates old demo sessions.

Run `pnpm browser:install` once for a task-owned Chromium headless installation in
`.local/browsers/`. Reuse it across checks instead of downloading another browser
per run. CI installs the same pinned headless browser and its Linux dependencies.
Both browser installation and verification honor `PLAYWRIGHT_BROWSERS_PATH` when
explicitly set, so an isolated checkout can reuse an existing task-owned download.
`pnpm verify` runs two Chromium journeys against its built API/web, with fresh
browser contexts. The denied-access journey is read-only; the correction journey
starts with Beacon's empty checklist and submits company details, contact details,
CSV and PDF files before correction, review and activation. It checks both file
downloads against the submitted bytes and retains state through activation.
Each verification gets a fresh database. The tests have one worker, no retries,
and explicit readiness/identity assertions.
Failed browser checks retain screenshots and traces in `.local/reports/browser/`;
the next run replaces that browser output. CI uploads diagnostics for three days.

For interactive inspection, keep `pnpm dev` running and open its reported URL in
the thread's collaborative browser. If that browser is unavailable, Playwright
can inspect the same real local services with `PLAYWRIGHT_BROWSERS_PATH` pointing
to this repository's `.local/browsers/`. Do not use another application's preview.

Each run has rotating service logs bounded to two 5 MiB files. Successful-run logs
are discarded. The latest failed run's error and service log replace prior files
in `.local/reports/`; older cleaned run directories are removed. Preserve a
specific reproduction only deliberately. Portfolio media belongs under `docs/`.

To exercise failure cleanup, set `VERIFY_FAIL_AT` to `before-database` or
`after-database` for one `pnpm verify` invocation, then remove that variable.
The command must fail and leave its manifest marked `cleaned`. A normal demo
shutdown through `env:clean` must free all three ports and the WSL keep-alive.

## Migrations and application boundaries

The API checks reminders at startup and every five seconds, with one worker tick
at a time and timer cleanup on close. PostgreSQL stores pending outbox rows and a
unique `(onboarding, kind, UTC day)` key. Workers lock pending rows with
`SKIP LOCKED`; inbox insertion and delivery acknowledgement share a transaction.
Restart tests launch two separate Node processes against the same verification DB.
Per-workspace demo clocks persist in PostgreSQL. Account managers can advance
their session workspace by exactly 24 hours. Authentication uses wall-clock time.
The inbox contains the latest 50 accessible messages. This is local delivery;
external email would need its own provider idempotency and retry policy.

Edit `apps/api/src/schema.ts`, then run `pnpm db:generate`. Commit generated SQL
and metadata with the behavior change. New environments apply migrations through
`apps/api/src/prepare.ts`; seeding is idempotent and uses fixed identities.

The API binds to loopback and requires `APP_ENV=demo`. Sessions use opaque,
HttpOnly cookies backed by hashed tokens. Customer and workspace checks happen
on the server for reads and writes. The local persona picker, synthetic clock,
and local files are explicit demo limits; public hosting and production identity
are outside this project.

PDF agreements and UTF-8 CSV samples are limited to 2 MiB. Files use opaque local
storage identifiers; every current or historical download goes through the same
server-side customer/workspace checks. File validation checks the expected
extension and sample content signature/encoding; malware scanning is outside the
demo. Replacement failures remove their newly written file. Revision history
retains earlier successful submissions and their review reasons.

Uploads consume the complete multipart body before saving a file or revision.
Extra parts, oversized files and malformed bodies reject the whole submission.
The pnpm patch in `patches/@fastify__busboy@3.2.3.patch` handles errors on parts
discarded by the parser's limits. The parser still reports malformed-body errors
to the request; the discarded part's duplicate error no longer terminates Node.
Keep this patch until an upstream release covers that case. API regressions check
extra fields, extra files and a truncated trailing part without persistent writes.
