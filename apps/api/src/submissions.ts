import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import type { Actor, submissionInput } from "../../../packages/contracts/src/index.js";
import { ApiError, onboardingFor } from "./access.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export async function submitContent(
  db: Database,
  actor: Actor,
  onboardingId: string,
  requirementId: string,
  input: typeof submissionInput.infer,
  now: Date,
  file?: { storageId: string; fileName: string; mediaType: string; size: number },
) {
  await onboardingFor(db, actor, onboardingId);
  if (actor.role !== "customer")
    throw new ApiError(403, "Only the assigned customer can submit information.");
  if (!input.content.trim())
    throw new ApiError(400, "Enter the requested information before submitting.");
  await db.transaction(async (tx) => {
    const [onboarding] = await tx
      .select()
      .from(s.onboardings)
      .where(eq(s.onboardings.id, onboardingId))
      .for("update");
    if (!onboarding) throw new ApiError(404, "Onboarding not found.");
    if (onboarding.activeAt)
      throw new ApiError(
        409,
        "This account is active. Ask the account manager to reopen onboarding before changing information.",
      );
    const [requirement] = await tx
      .select()
      .from(s.requirements)
      .where(
        and(eq(s.requirements.id, requirementId), eq(s.requirements.onboardingId, onboardingId)),
      );
    if (!requirement) throw new ApiError(404, "Requirement not found.");
    if (!file && requirement.kind !== "company" && requirement.kind !== "contact")
      throw new ApiError(400, "This requirement needs a document upload.");
    if (file && requirement.kind !== "agreement" && requirement.kind !== "import")
      throw new ApiError(400, "This requirement needs written details.");
    if (requirement.version !== input.version)
      throw new ApiError(409, "This requirement changed. Refresh it before submitting again.");
    const id = randomUUID();
    const [previous] = await tx
      .select({ total: count() })
      .from(s.revisions)
      .where(eq(s.revisions.requirementId, requirementId));
    await tx.insert(s.revisions).values({
      id,
      requirementId,
      content: input.content.trim(),
      number: (previous?.total ?? 0) + 1,
      ...file,
      actorId: actor.userId,
      createdAt: now.toISOString(),
    });
    await tx
      .update(s.requirements)
      .set({
        state: "submitted",
        currentRevisionId: id,
        version: sql`${s.requirements.version} + 1`,
      })
      .where(eq(s.requirements.id, requirementId));
    await tx
      .update(s.onboardings)
      .set({
        startedAt: onboarding.startedAt ?? now.toISOString(),
        version: sql`${s.onboardings.version} + 1`,
      })
      .where(eq(s.onboardings.id, onboardingId));
    await tx.insert(s.activity).values({
      id: randomUUID(),
      onboardingId,
      actorId: actor.userId,
      message: `Submitted ${requirement.title.toLowerCase()}`,
      createdAt: now.toISOString(),
    });
  });
  return { ok: true };
}
