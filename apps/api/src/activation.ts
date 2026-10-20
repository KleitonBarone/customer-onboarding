import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Actor } from "../../../packages/contracts/src/index.js";
import { activationBlockers, canActivate } from "../../../packages/contracts/src/workflow.js";
import { ApiError, onboardingFor } from "./access.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export async function changeActivation(
  db: Database,
  actor: Actor,
  id: string,
  version: number,
  action: "activate" | "reopen",
  now: Date,
  reason = "",
) {
  await onboardingFor(db, actor, id);
  if (actor.role !== "manager")
    throw new ApiError(403, "Only an account manager can activate or reopen an account.");
  if (action === "reopen" && !reason.trim())
    throw new ApiError(400, "Explain why onboarding needs to be reopened.");
  await db.transaction(async (tx) => {
    const [onboarding] = await tx
      .select()
      .from(s.onboardings)
      .where(eq(s.onboardings.id, id))
      .for("update");
    if (!onboarding) throw new ApiError(404, "Onboarding not found.");
    if (onboarding.version !== version)
      throw new ApiError(409, "This onboarding changed. Refresh it before continuing.");
    if (action === "activate") {
      if (onboarding.activeAt) throw new ApiError(409, "This account is already active.");
      const requirements = await tx
        .select()
        .from(s.requirements)
        .where(eq(s.requirements.onboardingId, id));
      if (!canActivate(requirements))
        throw new ApiError(
          409,
          `Activation needs approval of every mandatory current submission. Pending: ${
            activationBlockers(requirements)
              .map((item) => item.title)
              .join(", ") || "a complete mandatory checklist"
          }.`,
        );
    } else if (!onboarding.activeAt)
      throw new ApiError(409, "Only an active account can be reopened.");
    await tx
      .update(s.onboardings)
      .set({
        activeAt: action === "activate" ? now.toISOString() : null,
        version: sql`${s.onboardings.version} + 1`,
      })
      .where(eq(s.onboardings.id, id));
    await tx.insert(s.activity).values({
      id: randomUUID(),
      onboardingId: id,
      actorId: actor.userId,
      message:
        action === "activate" ? "Activated account" : `Reopened onboarding: ${reason.trim()}`,
      createdAt: now.toISOString(),
    });
  });
  return { ok: true };
}
