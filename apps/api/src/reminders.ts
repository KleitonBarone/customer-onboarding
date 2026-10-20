import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Actor } from "../../../packages/contracts/src/index.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export async function demoTime(db: Database, workspaceId: string) {
  const [clock] = await db
    .select()
    .from(s.demoClocks)
    .where(eq(s.demoClocks.workspaceId, workspaceId));
  if (!clock) throw new Error("The workspace demo clock is missing.");
  return new Date(clock.now);
}

export async function advanceDemoTime(db: Database, workspaceId: string) {
  const [clock] = await db
    .update(s.demoClocks)
    .set({ now: sql`${s.demoClocks.now} + interval '24 hours'` })
    .where(eq(s.demoClocks.workspaceId, workspaceId))
    .returning();
  if (!clock) throw new Error("The workspace demo clock is missing.");
  return { now: new Date(clock.now).toISOString() };
}

// Business writes take this same onboarding lock. Queue only customer blockers;
// a UTC date is the policy window, with uniqueness enforced by PostgreSQL.
export async function enqueueReminders(db: Database, workspaceId: string, now: Date) {
  return db.transaction(async (tx) => {
    const accounts = await tx
      .select({ id: s.customerAccounts.id, name: s.customerAccounts.name })
      .from(s.customerAccounts)
      .where(eq(s.customerAccounts.workspaceId, workspaceId));
    if (!accounts.length) return;
    const onboardings = await tx
      .select()
      .from(s.onboardings)
      .where(
        and(
          inArray(
            s.onboardings.customerId,
            accounts.map((item) => item.id),
          ),
          isNotNull(s.onboardings.startedAt),
          isNull(s.onboardings.activeAt),
        ),
      )
      .orderBy(asc(s.onboardings.id))
      .for("update");
    for (const onboarding of onboardings) {
      const requirements = await tx
        .select()
        .from(s.requirements)
        .where(eq(s.requirements.onboardingId, onboarding.id));
      const blockers = requirements.filter(
        (item) =>
          item.mandatory && (item.state === "missing" || item.state === "changes_requested"),
      );
      if (!blockers.length) continue;
      const company = accounts.find((item) => item.id === onboarding.customerId)?.name;
      await tx
        .insert(s.notificationOutbox)
        .values({
          id: randomUUID(),
          onboardingId: onboarding.id,
          kind: "customer_action",
          window: now.toISOString().slice(0, 10),
          createdAt: now.toISOString(),
          message: `${company}: please complete or correct ${blockers.map((item) => item.title.toLowerCase()).join(", ")}.`,
        })
        .onConflictDoNothing();
    }
  });
}

// Local inbox delivery and acknowledgement commit together. A crashed worker
// leaves pending rows; concurrent workers skip claimed rows and cannot duplicate.
export async function deliverReminders(db: Database, now: Date) {
  return db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(s.notificationOutbox)
      .where(isNull(s.notificationOutbox.deliveredAt))
      .orderBy(asc(s.notificationOutbox.id))
      .limit(50)
      .for("update", { skipLocked: true });
    for (const item of pending) {
      await tx
        .insert(s.notificationInbox)
        .values({ outboxId: item.id, deliveredAt: now.toISOString() })
        .onConflictDoNothing();
      await tx
        .update(s.notificationOutbox)
        .set({ deliveredAt: now.toISOString() })
        .where(eq(s.notificationOutbox.id, item.id));
    }
    return pending.length;
  });
}

export async function runReminders(db: Database) {
  const workspaces = await db.select().from(s.demoClocks);
  for (const clock of workspaces) {
    const now = new Date(clock.now);
    await enqueueReminders(db, clock.workspaceId, now);
  }
  // Delivery time is operational wall time; the policy clock is per workspace.
  await deliverReminders(db, new Date());
}

export async function listNotifications(db: Database, actor: Actor) {
  const assignments =
    actor.role === "customer"
      ? await db
          .select()
          .from(s.customerMemberships)
          .where(eq(s.customerMemberships.membershipId, actor.membershipId))
      : null;
  if (assignments?.length === 0) return [];
  return db
    .select({
      id: s.notificationOutbox.id,
      onboardingId: s.onboardings.id,
      company: s.customerAccounts.name,
      message: s.notificationOutbox.message,
      window: s.notificationOutbox.window,
      createdAt: s.notificationOutbox.createdAt,
    })
    .from(s.notificationInbox)
    .innerJoin(s.notificationOutbox, eq(s.notificationOutbox.id, s.notificationInbox.outboxId))
    .innerJoin(s.onboardings, eq(s.onboardings.id, s.notificationOutbox.onboardingId))
    .innerJoin(s.customerAccounts, eq(s.customerAccounts.id, s.onboardings.customerId))
    .where(
      and(
        eq(s.customerAccounts.workspaceId, actor.workspaceId),
        assignments
          ? inArray(
              s.customerAccounts.id,
              assignments.map((item) => item.customerId),
            )
          : undefined,
      ),
    )
    .orderBy(desc(s.notificationOutbox.createdAt), asc(s.notificationOutbox.id))
    .limit(50);
}
