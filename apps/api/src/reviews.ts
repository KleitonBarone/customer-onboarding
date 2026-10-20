import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Actor, reviewInput } from "../../../packages/contracts/src/index.js";
import { ApiError, onboardingFor } from "./access.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export async function reviewRequirement(
  db: Database,
  actor: Actor,
  onboardingId: string,
  requirementId: string,
  input: typeof reviewInput.infer,
  now: Date,
) {
  await onboardingFor(db, actor, onboardingId);
  if (actor.role !== "reviewer")
    throw new ApiError(403, "Only a reviewer can approve information or request corrections.");
  const reason = input.reason.trim();
  if (input.decision === "changes_requested" && !reason)
    throw new ApiError(400, "Explain what the customer needs to correct.");
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
        "This account is active. The account manager must reopen it before further review.",
      );
    const [requirement] = await tx
      .select()
      .from(s.requirements)
      .where(
        and(eq(s.requirements.id, requirementId), eq(s.requirements.onboardingId, onboardingId)),
      );
    if (!requirement) throw new ApiError(404, "Requirement not found.");
    if (
      requirement.version !== input.version ||
      requirement.currentRevisionId !== input.revisionId ||
      requirement.state !== "submitted"
    )
      throw new ApiError(
        409,
        "This submission changed or was already reviewed. Refresh before deciding.",
      );
    await tx.insert(s.reviews).values({
      id: randomUUID(),
      revisionId: input.revisionId,
      actorId: actor.userId,
      decision: input.decision,
      reason,
      createdAt: now.toISOString(),
    });
    await tx
      .update(s.requirements)
      .set({ state: input.decision, version: sql`${s.requirements.version} + 1` })
      .where(eq(s.requirements.id, requirementId));
    await tx
      .update(s.onboardings)
      .set({ version: sql`${s.onboardings.version} + 1` })
      .where(eq(s.onboardings.id, onboardingId));
    await tx.insert(s.activity).values({
      id: randomUUID(),
      onboardingId,
      actorId: actor.userId,
      message:
        input.decision === "approved"
          ? `Approved ${requirement.title.toLowerCase()}`
          : `Requested correction for ${requirement.title.toLowerCase()}: ${reason}`,
      createdAt: now.toISOString(),
    });
  });
  return { ok: true };
}
