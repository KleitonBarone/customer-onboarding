# Delivery sequence

Execute one branch at a time, starting each from the verified previous merge on
main. Each delivery PR has three focused commits, a draft PR, review/CI checks,
an actual GitHub squash merge, and verification/cleanup on merged main. Extra fix
commits or PRs are allowed when an observed failure requires them.

1. `feat/01-foundation`: add the environment, scoped demo sessions, and the first
   customer submission visible to an employee. Environment setup includes real
   PostgreSQL, disposable verification, browser inspection, and ownership-based
   cleanup from the beginning.
2. `feat/02-document-review`: add private file revisions/downloads, reviewer
   decisions, corrections, and inspectable history.
3. `feat/03-activation-rules`: derive readiness from mandatory approvals, add
   transactional activation/reopening, and test concurrent write conflicts.
4. `feat/04-work-queue`: add the employee queue with next actions, all deterministic
   seed scenarios, filters, and a guarded demo reset.
5. `feat/05-local-reminders`: add the durable outbox, local inbox, demo clock, and
   restart/concurrency/deduplication tests.
6. `feat/06-workflow-verification`: automate the two built-app browser journeys,
   refine keyboard/narrow layouts, and run the same isolated lifecycle in CI.
7. `docs/07-portfolio-handoff`: rehearse clean setup, record the English walkthrough
   and screenshots, write the case study, record measured local evidence, and
   verify final cleanup.

Before each PR, merge the latest origin/main into the feature branch and run
`pnpm verify`. Inspect delivered behavior while `pnpm dev` runs, stop it with
`pnpm env:clean`, and check `pnpm env:status`. Address verified bot findings and
CI failures; gather unresolved human comments for Kleiton. Mark the draft ready
only after the latest head passes, then squash-merge that exact head. Fetch and
fast-forward main, verify the merge is present, and run verification/cleanup
before starting the next branch. Do not bypass protections or deploy anything.

The final evidence document will record actual PR URLs, tested commits, merge
commits, and results. Public hosting is outside this delivery sequence.

## Completed merges

- [PR 6](https://github.com/KleitonBarone/customer-onboarding/pull/6), tested head
  `9d1e5fd`, merged as `b716baa`. PR/main CI and merged-main local verification
  passed. Twenty PostgreSQL/API tests and two built-app browser journeys cover
  correction/activation, private downloads, scope, keyboard, filters and recovery.
- [PR 7](https://github.com/KleitonBarone/customer-onboarding/pull/7) closes the
  handoff with setup rehearsal, media, case study and measured evidence. Its
  GitHub record is authoritative for its checked head and eventual merge SHA.
  The clean checkout exposed a browser-cache override bug, fixed in the additional
  focused commit `d59baf1`. Final verification also exposed repeated-persona
  timing in the browser helper; assertions now await the session replacement.
  See [evidence](EVIDENCE.md) for results and limits.

- [PR 5](https://github.com/KleitonBarone/customer-onboarding/pull/5), tested head
  `9d335ef`, merged as `619c2f2`. PR/main CI and merged-main local verification
  passed. Twenty tests include concurrent reminder deduplication, UTC windows,
  recovery across two separate Node starts, inbox isolation, and clock scope.
  Browser clock/inbox/mobile checks passed. All run resources cleaned.

- [PR 4](https://github.com/KleitonBarone/customer-onboarding/pull/4), tested head
  `10868a0`, merged as `a4b5c15`. PR/main CI and merged-main local verification
  passed. Seventeen tests, queue filters/empty recovery, 390/900px layouts,
  correction-to-activation, and two guarded fixture resets passed. Resources cleaned.

- [PR 3](https://github.com/KleitonBarone/customer-onboarding/pull/3), tested head
  `f6d143f`, merged as `ba3ab40`. PR/main CI and merged-main local verification
  passed. Fourteen tests and a browser correction/activation/reopening journey
  passed, including narrow layout and active-edit denial. All run resources cleaned.

- [PR 1](https://github.com/KleitonBarone/customer-onboarding/pull/1), tested head
  `d88f6a7`, merged as `b31d5ac`. PR/main CI and merged-main local verification
  passed. Browser submission, isolation, narrow layout, controlled failure cleanup,
  graceful shutdown, and forced-stop orphan recovery were checked locally.
- [PR 2](https://github.com/KleitonBarone/customer-onboarding/pull/2), tested head
  `39e8c68`, merged as `f0e19c0`. PR/main CI and merged-main local verification
  passed. Nine PostgreSQL/API tests and browser upload/correction/download/isolation
  checks passed; development and verification resources were removed.
