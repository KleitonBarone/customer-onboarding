import { asc, desc, eq } from "drizzle-orm";
import type { Actor } from "../../../packages/contracts/src/index.js";
import { onboardingStatus } from "../../../packages/contracts/src/workflow.js";
import { onboardingFor } from "./access.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export async function getOnboarding(db: Database, actor: Actor, id: string) {
  const { onboarding, account } = await onboardingFor(db, actor, id);
  const [owner] = await db.select().from(s.users).where(eq(s.users.id, account.ownerId));
  const requirements = await db
    .select()
    .from(s.requirements)
    .where(eq(s.requirements.onboardingId, id))
    .orderBy(asc(s.requirements.id));
  requirements.sort(
    (a, b) =>
      s.requirementKind.enumValues.indexOf(a.kind) - s.requirementKind.enumValues.indexOf(b.kind),
  );
  const revisions = await db
    .select({
      id: s.revisions.id,
      requirementId: s.revisions.requirementId,
      content: s.revisions.content,
      number: s.revisions.number,
      fileName: s.revisions.fileName,
      mediaType: s.revisions.mediaType,
      size: s.revisions.size,
      actor: s.users.name,
      createdAt: s.revisions.createdAt,
    })
    .from(s.revisions)
    .innerJoin(s.requirements, eq(s.requirements.id, s.revisions.requirementId))
    .innerJoin(s.users, eq(s.users.id, s.revisions.actorId))
    .where(eq(s.requirements.onboardingId, id))
    .orderBy(desc(s.revisions.createdAt));
  const activity = await db
    .select({
      id: s.activity.id,
      actor: s.users.name,
      message: s.activity.message,
      createdAt: s.activity.createdAt,
    })
    .from(s.activity)
    .innerJoin(s.users, eq(s.users.id, s.activity.actorId))
    .where(eq(s.activity.onboardingId, id))
    .orderBy(desc(s.activity.position));
  const reviews = await db
    .select({
      id: s.reviews.id,
      revisionId: s.reviews.revisionId,
      actor: s.users.name,
      decision: s.reviews.decision,
      reason: s.reviews.reason,
      createdAt: s.reviews.createdAt,
    })
    .from(s.reviews)
    .innerJoin(s.revisions, eq(s.revisions.id, s.reviews.revisionId))
    .innerJoin(s.requirements, eq(s.requirements.id, s.revisions.requirementId))
    .innerJoin(s.users, eq(s.users.id, s.reviews.actorId))
    .where(eq(s.requirements.onboardingId, id))
    .orderBy(desc(s.reviews.createdAt));
  return {
    onboarding: {
      ...onboarding,
      company: account.name,
      owner: owner?.name ?? "Unassigned",
      status: onboardingStatus(onboarding, requirements),
    },
    requirements,
    revisions,
    reviews,
    activity,
  };
}
