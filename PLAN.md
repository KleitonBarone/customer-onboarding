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

- [ ] Scaffold the smallest web/API/database structure and initial migrations.
- [ ] Add workspace and customer membership plus synthetic sessions.
- [ ] Seed one onboarding and show its checklist in the customer portal.
- [ ] Let the customer submit one requirement and show it in the employee view.
- [ ] Record working setup, migration, seed, development, and check commands.

Done when a fresh local install can show one submission in both views and an
unrelated customer cannot retrieve it by changing a URL or API identifier.

### 2. Review and activation

- [ ] Add revisioned file submissions and authorized downloads.
- [ ] Allow reviewers to approve or request changes with a visible explanation.
- [ ] Permit correction and resubmission while retaining earlier revisions.
- [ ] Enforce activation rules on the server inside the database transaction.
- [ ] Record actor-derived activity with each successful business change.

Done when the correction-to-activation story works and two reviewers cannot
silently overwrite each other's decisions. Use a version check or equivalent
explicit concurrency control.

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
- [ ] Check keyboard use, form labels, narrow layouts, and meaningful error states.

Use real PostgreSQL integration tests for transaction and isolation behavior.
Keep pure rule tests small. Avoid snapshots or tests that just repeat component
markup. Capture failures with enough context to reproduce them.

### 5. Portfolio handoff

- [ ] Record an English walkthrough of roughly 90 seconds.
- [ ] Capture the queue, customer checklist, and review history screens.
- [ ] Write a short case study about isolation, activation rules, and one tradeoff.
- [ ] Rehearse setup from a clean checkout and update the README with proven steps.
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
