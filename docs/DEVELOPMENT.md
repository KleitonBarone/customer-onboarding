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

The runner records identities and task-owned paths in `.local/runs/<run-id>/`.
API and web processes are launched directly so their recorded identities survive
wrapper exits. Cleanup checks process start times before termination and verifies
deletion paths stay inside the task workspace. It removes disposable containers,
volumes, networks, and uploads, without touching other projects or shared caches.

## Browser inspection and diagnostics

Run `pnpm browser:install` once for a task-owned Chromium headless installation in
`.local/browsers/`. Reuse it across checks instead of downloading another browser
per run. Automated browser journeys will join verification in delivery PR 6.

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

Edit `apps/api/src/schema.ts`, then run `pnpm db:generate`. Commit generated SQL
and metadata with the behavior change. New environments apply migrations through
`apps/api/src/prepare.ts`; seeding is idempotent and uses fixed identities.

The API binds to loopback and requires `APP_ENV=demo`. Sessions use opaque,
HttpOnly cookies backed by hashed tokens. Customer and workspace checks happen
on the server for reads and writes. The local persona picker, synthetic clock,
and local files are explicit demo limits; public hosting and production identity
are outside this project.
