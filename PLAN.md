# Customer onboarding implementation plan

## Purpose and audience

Build an application that helps an account manager get a newly signed business
customer ready to use a service. The customer supplies company information and
documents; an employee reviews the submission and resolves blockers.

The portfolio reader should understand that workflow in one screenshot. A hiring
engineer should be able to inspect organization isolation, authorization, domain
rules, and how the interface represents incomplete or rejected work.

All companies, people, documents, timestamps, and activity are synthetic. Testing
is performed by the author in a local environment. Real customers are not a
dependency, and the project must not claim independently validated product fit.

## Smallest complete product

Use a fictional B2B analytics provider onboarding a retailer. Its checklist has
company details, a service agreement, a sample import file, and a launch contact.
The interface needs an employee work queue, an onboarding detail view, and a
customer portal. Avoid a generic form builder or full CRM.

Employee roles are account manager and reviewer. Customers can access only the
onboarding records explicitly assigned to their customer account. A workspace
represents the service provider; customer accounts and their members live within
that workspace. Seed a second provider to exercise workspace isolation.

Requirements use `missing`, `submitted`, `changes_requested`, and `approved` states.
Activation requires every mandatory requirement to be approved. Uploading a
replacement creates a new revision and makes that requirement need review again.
An activated account cannot silently become incomplete: a blocked request explains
that the onboarding must be explicitly reopened by a permitted employee first.

The onboarding record uses `draft`, `in_progress`, `ready`, and `active`. Define
`ready` from the approved requirements instead of maintaining an unrelated flag.
Reopening an active onboarding records the actor and reason.

## Starting architecture

- Use pnpm, strict TypeScript, React with Vite, Tailwind, and TanStack Query.
- Use a small Fastify API and PostgreSQL with typed queries or Drizzle migrations.
- Validate untrusted request bodies at the boundary with ArkType. Keep inferred
  types; do not introduce `any` or casting wrappers to silence the compiler.
- Start with one application and database. A durable notification outbox can be
  processed by the API process for the first local demo. Do not add a broker.
- Keep synthetic uploaded files on local disk with opaque storage identifiers;
  authorize every download through the API. Bound sizes and allow safe sample
  formats. File scanning is outside this local demonstration.
- Use server-side demo sessions with an explicitly local persona picker.
  Authorization uses the session, never an actor supplied in a request body.
  Do not mistake a public persona picker for production authentication.

The initial schema should cover workspaces, users, memberships, customer accounts,
customer memberships, onboardings, requirements, submission revisions, reviews,
activity entries, sessions, and notification outbox records. Add entities when a
milestone needs them, rather than generating an entire framework upfront.

Reserve UI port 4310, API port 4311, and local database port 55431. Treat these as
planned defaults until verified during setup. Keep this project's database,
storage, and reset commands separate from the other portfolio apps.

## Development and test environment

Build the environment in the first delivery PR, before relying on feature tests.
The agent must be able to start, inspect, exercise, and stop the actual web app,
API, PostgreSQL, file storage, and reminder processor as those parts are added.
Use real local services for integration and browser checks. Keep pure rule tests
small; mocks do not establish that the complete workflow works.

- Pin compatible Node, pnpm, dependency, PostgreSQL image, and browser-tool versions.
  Commit the lockfile and environment examples. Use the same database version,
  migrations, fixtures, and checks locally and in CI.
- Check WSL Ubuntu's Docker endpoint, required tools, available ports, and existing
  resources before starting anything. Run Docker through WSL. Bind project services
  to local interfaces and leave existing build/preview channels alone.
- Separate interactive development from disposable verification. Give each
  verification run a unique Compose project, database, storage directory, and
  available ports. Never point tests at the interactive demo database. Record the
  run's URLs, resource IDs, process IDs with start identity, and owned paths under
  `.local/runs/<run-id>/`, without credentials.
- Migrate an empty database and load fixed synthetic fixtures before each run.
  Use an injectable clock and isolated browser sessions. Reset between independent
  journeys; retain state within a journey and during intentional restart checks.
- Wait for database connectivity, API readiness, and the served web app with bounded
  health checks. Report which dependency failed rather than sleeping for a fixed
  interval or silently retrying a broken environment.
- Inspect each delivered slice in the browser from milestone 1 onward. Use the
  thread's collaborative browser on the URL reported by a running `pnpm dev`
  session, then stop that session after inspection. Verify visible actions,
  API results, and persisted state across customer and employee sessions. As
  features arrive, exercise correction, activation, denied access, authorized file
  downloads, and reminder/restart behavior. Automate the two primary browser
  journeys in milestone 4; do not postpone hands-on verification until then.
- Run final end-to-end checks against built web/API artifacts as well as using
  development servers during implementation. Capture browser console/request
  failures, screenshots or traces, and relevant service logs before teardown.
  Record the tested commit, scenario, command, and actual result.

Provide a small set of root commands. These names are proposed contracts, not
commands that exist yet:

- `pnpm env:doctor` checks prerequisites, configuration, ports, and resource conflicts.
- `pnpm dev` starts the project-owned interactive stack, waits for readiness, prints
  its URLs, and shuts down its owned processes/services on exit or Ctrl+C.
- `pnpm verify` provisions disposable resources, migrates, seeds, builds, runs the
  checks available at that milestone, and always tears down. Include real database
  tests from the first slice and browser journeys once implemented. CI uses the
  same check sequence with its own disposable services.
- `pnpm env:status` lists this project's recorded resources and retained artifacts,
  including anything left after an interrupted run.
- `pnpm env:clean` safely retries cleanup of recorded disposable resources. It is
  idempotent, validates ownership, and refuses unrecorded or protected data.

Before PR 1 can merge, run verification twice from fresh state and check cleanup
after a controlled startup/test failure and an interruption. Later PRs must prove
their behavior on this environment and leave no unexplained resources behind.

## Cleanup throughout development

Cleanup is part of every run and every PR, not only the portfolio handoff.

1. Before launch, inventory existing resources and record exactly what this run
   will own. Install `try/finally` cleanup and interruption handling before creating
   services. Use an explicit Compose project and the same files for every operation.
2. On success, failure, or cancellation, stop owned web/API process trees, reminder
   timers, and test browser contexts. Close agent-created preview tabs. Remove
   disposable containers, networks, database volumes, test uploads, and temporary
   checkout resources. Never terminate a process merely because it uses a port.
3. Remove task-created temporary image tags and disposable builders if any were
   needed. Remove newly pulled images only when no longer needed or used elsewhere.
   Reuse compatible dependencies during the task; do not download a new browser or
   duplicate the package store for every run. Preserve pre-existing shared caches.
4. Resolve filesystem targets and verify they remain within the recorded task-owned
   directory before deleting. Preserve source, environment files, committed demo
   media, backups, and intentionally retained application data. Demo reset and
   environment cleanup must enforce their separate identity/ownership guards.
5. Replace successful-run reports instead of accumulating copies. Keep only the
   latest failed run's useful diagnostics unless a particular reproduction is
   explicitly retained. Bound or rotate service logs. Record retained artifacts
   and their locations; do not delete committed portfolio evidence.
6. Check recorded resource IDs, process identities, and ports after teardown.
   Inspect `docker system df` after image builds or large pulls, without pruning.
   Report cleanup failures or explicitly retained data/services and why they remain.
   A run is not fully complete until cleanup succeeds or a retention decision is
   documented. Do not leave services running unless requested.

Never use global Docker prune commands, shared-cache deletion, WSL shutdown, or
disk compaction as routine cleanup. Remove only resources created for this work.

## Local simulation

Seed two fictional providers, several customers, and these scenarios:

- A new customer with missing requirements.
- A submitted customer waiting for review.
- A customer whose document needs a correction.
- A customer ready for activation.
- An active customer with a complete activity history.
- A second workspace and a separate customer within the first workspace for
  cross-workspace and cross-customer access checks.

Use fixed identifiers and an injectable clock so walkthroughs and reminder tests
do not depend on random output or real waiting. A notification inbox shows messages
that would have been sent. Advancing the demo clock produces a single reminder
per policy window, including after a process restart.

A reset may replace only this application's disposable local demo data. Require
an explicit demo environment and database identity check before destructive reset.
Never infer that an arbitrary connection string is disposable.

## Milestones

### 1. Foundation and first vertical slice

- [x] Scaffold the smallest web/API/database structure and initial migrations.
- [x] Add environment diagnostics, isolated verification, and scoped cleanup commands.
- [x] Add workspace and customer membership plus synthetic sessions.
- [x] Seed one onboarding and show its checklist in the customer portal.
- [x] Let the customer submit one requirement and show it in the employee view.
- [x] Record working setup, migration, seed, development, and check commands.
- [x] Inspect the first slice in the browser and verify cleanup on failure/interruption.

Done when a fresh local install can show one submission in both views and an
unrelated customer cannot retrieve it by changing a URL or API identifier. The
verification command must reproduce that result with disposable services and
clean up its resources, including after failure or interruption.

Implemented in the foundation delivery PR. Local evidence includes five real
PostgreSQL/API tests, two successful fresh verification runs of the submission
slice, a browser submission/employee/denied-access/persona-switch journey, narrow
layout inspection, controlled failure cleanup, and orphan recovery after a forced
terminal stop. See [development details](docs/DEVELOPMENT.md) for the Windows WSL
keep-alive and forced-stop recovery behavior. Remaining milestones are pending.

### 2. Review and activation

- [x] Add revisioned file submissions and authorized downloads.
- [x] Allow reviewers to approve or request changes with a visible explanation.
- [x] Permit correction and resubmission while retaining earlier revisions.
- [x] Enforce activation rules on the server inside the database transaction.
- [x] Record actor-derived activity with each successful business change.

Done when the correction-to-activation story works and two reviewers cannot
silently overwrite each other's decisions. Use a version check or equivalent
explicit concurrency control.

The document review and activation delivery PRs implement this milestone. Four
mandatory requirements use structured company/contact fields and PDF/CSV uploads.
Activation/reopening, submissions, and reviews share an onboarding row lock and
version checks. Fourteen local tests and the full correction-to-activation browser
journey pass, including active-edit denial, reasoned reopening, and replacement
invalidation. Earlier successful revisions and reviews remain available.

### 3. Useful employee workflow

- [ ] Add the work queue with status, account owner, age, and next required action.
- [ ] Add bounded filtering, useful empty states, and clear permission messages.
- [ ] Add the local notification inbox and durable reminder deduplication.
- [ ] Seed the remaining scenarios and add a scoped reset path.

Done when a user can identify and resolve a blocked onboarding without consulting
the database, and replaying a reminder run does not create duplicate messages.

### 4. Focused verification and interface quality

- [ ] Test workspace and customer isolation, including file download routes.
- [ ] Test activation gates, revision invalidation, and concurrent review conflicts.
- [ ] Test notification restart behavior and reminder deduplication.
- [ ] Add two browser journeys: a correction through activation, and denied access.
- [ ] Run built-app browser journeys on disposable services with failure diagnostics.
- [ ] Check keyboard use, form labels, narrow layouts, and meaningful error states.

Use real PostgreSQL integration tests for transaction and isolation behavior.
Keep pure rule tests small. Avoid snapshots or tests that just repeat component
markup. Capture failures with enough context to reproduce them.

### 5. Portfolio handoff

- [ ] Record an English walkthrough of roughly 90 seconds.
- [ ] Capture the queue, customer checklist, and review history screens.
- [ ] Write a short case study about isolation, activation rules, and one tradeoff.
- [ ] Rehearse setup from a clean checkout and update the README with proven steps.
- [ ] Rehearse shutdown/cleanup and document any intentionally retained resources.
- [ ] Record measured local results with the commit, environment, dataset, and limits.

The core demo must remain usable locally. Hosting can be a later, separately
requested task; it is not necessary to complete this plan.

## Demonstration script

1. Open the employee queue and select a blocked customer.
2. Switch to that customer's synthetic session and submit the missing material.
3. As reviewer, request a correction with a reason visible to the customer.
4. Submit the revised document, approve all requirements, and activate the account.
5. Show the revision/activity history and an API denial for an unrelated account.

## Scope boundaries and evidence

Exclude billing, real identity verification, legal e-signatures, a workflow builder,
chat, sales automation, AI extraction, and multi-region deployment from the MVP.
The persona picker and local file handling are explicit demo constraints.

Success means the documented scenarios work, permissions hold under direct API
access, reset is repeatable, and the project explains its limits. A local test of
workflow completion is evidence of that scenario, not a claim that onboarding time
or support costs fell for actual customers.

## Development references

- [Vite setup](https://vite.dev/guide/)
- [Fastify TypeScript reference](https://fastify.dev/docs/latest/Reference/TypeScript/)

Check current supported versions when scaffolding. Links identify intended tools;
they do not mean the application has already been implemented.
