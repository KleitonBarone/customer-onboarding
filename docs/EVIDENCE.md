# Local verification evidence

Recorded on **2026-10-20**. This is author-performed testing with synthetic data.
There are no real users, customer adoption measurements, performance benchmarks,
or business-impact claims.

## Reproduce

Use the pinned tools in the [README](../README.md), then run:

```sh
pnpm install --frozen-lockfile
pnpm browser:install
pnpm verify
pnpm env:status
```

Verification uses a new database, migrations, fixtures, storage directory,
Compose project and available ports. It builds before serving the browser
journeys, closes their contexts, and tears down its services in `finally`.

## Environment and dataset

Windows PowerShell; Node 24.20.0; pnpm 11.23.0; WSL Ubuntu Docker 29.8.0 /
Compose 5.5.1; PostgreSQL 18.6 on Alpine with the digest pinned in `compose.yaml`;
Playwright 1.64.1 / Chromium headless shell 156.0.8078.4. GitHub Actions runs the
same verification on Ubuntu with the pinned Node, pnpm, database and browser.

The fixed demo starts at 2026-10-15 12:00 UTC. Northstar contains five accounts:
Beacon (draft), Atlas (submitted), Juniper (agreement correction), Cedar (ready),
and Lumen (active). Elsewhere contains Westhaven for provider isolation. There
are two Northstar account managers, a reviewer, and assigned customer personas.
The checklist has four mandatory requirements; PDF/CSV fixtures contain fictional
data. Tests create additional isolated fixture accounts inside their disposable DB.

## Observed results

- **20 tests pass** against PostgreSQL: session scope, assigned-account and
  workspace access, private current/historical files, input limits, correction
  history, stale/concurrent review, readiness rules, activation/replacement races,
  filters/pagination, reset guards, UTC reminder windows, concurrent replay,
  pending delivery across two separate Node starts, inbox scope and clock scope.
- **Two Chromium journeys pass without retries** against built artifacts:
  correction through activation with exact downloaded bytes and retained history;
  denied customer/provider access with persona cache clearing. They also exercise
  skip navigation, keyboard file input, filter clearing, queue failure/retry and
  a 390px layout. Manual inspections additionally covered 900px layouts and
  reasoned reopening/reapproval/reactivation.
- Lint, strict TypeScript, web/API builds, PostgreSQL readiness and the built
  web/API proxy check pass locally and in PR/main CI.
- The foundation was verified twice from fresh state. A controlled startup failure
  and forced-stop recovery left owned resources cleaned. Two guarded resets
  restored Juniper's original correction, version, four revisions and private PDF.
- The walkthrough is **90.44 seconds**, H.264/AAC at 1280×800, 2,402,067 bytes.
  It was decoded successfully and screenshots were visually inspected. Narration
  is synthetic English; the screen interaction is the actual local app.

## Clean checkout and delivery records

A detached checkout at **`7384431`** started without `node_modules` or run data.
`pnpm install --frozen-lockfile` reused the existing shared package store with
zero downloaded packages. The first browser launch exposed an ignored cache-path
override; its database tests/build passed and failure cleanup completed. Commit
**`d59baf1`** fixes that override in installation and verification. The checkout was
updated to that commit and the complete install/verification/status sequence rerun,
reusing this task's browser via `PLAYWRIGHT_BROWSERS_PATH`.
Application behavior and media correspond to **`b716baa`**; later changes are
documentation and the browser-cache fix. The final PR and merged main run the complete checks.

| PR | Verified branch head | Squash merge |
| --- | --- | --- |
| [1 — Foundation](https://github.com/KleitonBarone/customer-onboarding/pull/1) | `d88f6a7` | `b31d5ac` |
| [2 — Review](https://github.com/KleitonBarone/customer-onboarding/pull/2) | `39e8c68` | `f0e19c0` |
| [3 — Activation](https://github.com/KleitonBarone/customer-onboarding/pull/3) | `f6d143f` | `ba3ab40` |
| [4 — Queue/reset](https://github.com/KleitonBarone/customer-onboarding/pull/4) | `10868a0` | `a4b5c15` |
| [5 — Reminders](https://github.com/KleitonBarone/customer-onboarding/pull/5) | `9d335ef` | `619c2f2` |
| [6 — Browser/CI](https://github.com/KleitonBarone/customer-onboarding/pull/6) | `9d1e5fd` | `b716baa` |
| [7 — Handoff](https://github.com/KleitonBarone/customer-onboarding/pull/7) | See GitHub's checked head | See GitHub's merge record |

Each planned branch has three focused commits; handoff adds the observed browser
cache fix as a fourth commit. The actual GitHub PR record holds
its full head/merge SHA and checks; the final PR cannot embed its own eventual
merge SHA. [Delivery](DELIVERY.md) describes the sequence.

## Cleanup and limits

Runs remove owned processes, timers, containers, networks, volumes and uploads.
The clean checkout is removed after rehearsal. Final handoff removes task-created
temporary recordings, narration, browser binaries and the newly pulled PostgreSQL
image after the last merged-main verification. Installed project dependencies,
the shared pnpm store, two compact cleanup manifests, the original delivery-plan
HTML, and committed media remain.
No existing Docker networks, other projects, WSL settings or live services are
changed. No hosting was deployed.

The demo uses local personas, local files and SQL inbox delivery. It has no real
identity provider, malware scanner, email delivery or load testing. Process-restart
tests recover pending work; they do not simulate every possible crash point.
See [architecture](ARCHITECTURE.md) for the filesystem/SQL atomicity tradeoff.
