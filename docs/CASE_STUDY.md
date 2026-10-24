# From a correction request to an active account

A newly signed retailer can still be unable to launch: company information is
incomplete, an agreement needs correction, or an employee has not reviewed the
latest document. Relay gives each participant a clear next action and preserves
the decisions that led to activation. The project is a local portfolio demo built
with fictional providers and customers.

## Keep access close to the data

A provider workspace contains customer accounts. Employee memberships belong to
the provider; customer memberships also need an account assignment. The API
resolves identity from a server-side session and scopes each read and write.
Changing an onboarding ID or historical revision ID cannot bypass that scope.

The persona picker makes these roles easy to demonstrate locally. It deliberately
does not establish production identity. A public deployment would need real
authentication before this access model could be relied on.

## Make activation a domain rule

An approval belongs to one revision. A replacement returns that requirement to
review and retains the old file and decision. Readiness is derived from all
mandatory current approvals, while activation is an explicit manager action.

Submission, review, activation, and reopening transactions take the same
onboarding row lock. They check versions before changing state and append activity
in that transaction. If activation races a replacement, one action succeeds and
the other receives a conflict. The account cannot become active with an
unapproved replacement. Active accounts require a reasoned reopening before edits.

## Choose a small operational surface

One API process checks a PostgreSQL outbox at startup and every five seconds.
The database enforces one customer-action reminder per onboarding and UTC date.
Workers lock pending rows and commit local inbox delivery with acknowledgement.
Two separate Node starts verify that pending work survives and replay does not
duplicate the inbox message. A broker adds little value to this local workload.

Local filesystem uploads are a deliberate tradeoff. They keep the app independent
of paid services and demonstrate private downloads, but filesystem writes and SQL
cannot share an atomic commit. Failed requests compensate by deleting the new
file; a crash can leave an orphan until the disposable environment is removed.
Production storage would need reconciliation, scanning, and retention rules.

## Verify the complete scenario

The same lifecycle command provisions an empty PostgreSQL database, migrates and
seeds it, checks strict types and lint, runs API/domain and environment tests,
builds both apps, and runs two Chromium journeys. Tests cover scope, private files, stale/concurrent
review, activation races, reminders, and a correction reaching activation. Browser
checks include keyboard input, filter clearing, request recovery, and narrow layout.

Cleanup records process identity and resource ownership from startup. It removes
only that run's services, database volume, network, and uploads, including recovery
after a forced stop. This made repeated end-to-end inspection practical without
leaving a stack running between delivery PRs.

These are author-performed local results. There are no real customer outcomes,
load-test claims, or measured business savings. See [evidence](EVIDENCE.md) for
the exact dataset and delivery records, and [architecture](ARCHITECTURE.md) for
the boundaries and limits.
