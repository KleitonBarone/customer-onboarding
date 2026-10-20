import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { Actor, queueInput } from "../../../packages/contracts/src/index.js";
import { onboardingStatus } from "../../../packages/contracts/src/workflow.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

function nextAction(
  status: ReturnType<typeof onboardingStatus>,
  requirements: (typeof s.requirements.$inferSelect)[],
) {
  if (status === "active") return "Account active";
  if (status === "ready") return "Account manager to activate";
  const correction = requirements.find((item) => item.state === "changes_requested");
  if (correction) return `Customer to correct ${correction.title.toLowerCase()}`;
  const waiting = requirements.filter((item) => item.state === "submitted").length;
  return waiting
    ? `Reviewer to review ${waiting} ${waiting === 1 ? "submission" : "submissions"}`
    : "Customer to submit missing information";
}

export async function listOnboardings(
  db: Database,
  actor: Actor,
  input: typeof queueInput.infer,
  now: Date,
) {
  const memberships =
    actor.role === "customer"
      ? await db
          .select({ id: s.customerMemberships.customerId })
          .from(s.customerMemberships)
          .where(eq(s.customerMemberships.membershipId, actor.membershipId))
      : null;
  if (memberships?.length === 0) return [];
  const mandatory = db
    .select({ id: s.requirements.id })
    .from(s.requirements)
    .where(
      and(eq(s.requirements.onboardingId, s.onboardings.id), eq(s.requirements.mandatory, true)),
    );
  const pending = db
    .select({ id: s.requirements.id })
    .from(s.requirements)
    .where(
      and(
        eq(s.requirements.onboardingId, s.onboardings.id),
        eq(s.requirements.mandatory, true),
        or(ne(s.requirements.state, "approved"), isNull(s.requirements.currentRevisionId)),
      ),
    );
  const ready = sql<boolean>`(${exists(mandatory)} and ${notExists(pending)})`;
  const status = input.status
    ? {
        active: isNotNull(s.onboardings.activeAt),
        ready: and(isNull(s.onboardings.activeAt), ready),
        draft: and(isNull(s.onboardings.activeAt), isNull(s.onboardings.startedAt), not(ready)),
        in_progress: and(
          isNull(s.onboardings.activeAt),
          isNotNull(s.onboardings.startedAt),
          not(ready),
        ),
      }[input.status]
    : undefined;
  const records = await db
    .select({ onboarding: s.onboardings, account: s.customerAccounts, owner: s.users.name })
    .from(s.onboardings)
    .innerJoin(s.customerAccounts, eq(s.customerAccounts.id, s.onboardings.customerId))
    .innerJoin(s.users, eq(s.users.id, s.customerAccounts.ownerId))
    .where(
      and(
        eq(s.customerAccounts.workspaceId, actor.workspaceId),
        memberships
          ? inArray(
              s.customerAccounts.id,
              memberships.map((item) => item.id),
            )
          : undefined,
        input.ownerId ? eq(s.customerAccounts.ownerId, input.ownerId) : undefined,
        input.search?.trim()
          ? ilike(s.customerAccounts.name, `%${input.search.trim()}%`)
          : undefined,
        status,
      ),
    )
    .orderBy(asc(s.onboardings.createdAt), asc(s.onboardings.id))
    .limit(input.limit)
    .offset(input.offset);
  const requirements = records.length
    ? await db
        .select()
        .from(s.requirements)
        .where(
          inArray(
            s.requirements.onboardingId,
            records.map((item) => item.onboarding.id),
          ),
        )
    : [];
  return records.map(({ onboarding, account, owner }) => {
    const checklist = requirements.filter((item) => item.onboardingId === onboarding.id);
    const status = onboardingStatus(onboarding, checklist);
    return {
      ...onboarding,
      company: account.name,
      owner,
      ownerId: account.ownerId,
      status,
      ageDays: Math.max(
        0,
        Math.floor((now.getTime() - new Date(onboarding.createdAt).getTime()) / 86_400_000),
      ),
      nextAction: nextAction(status, checklist),
    };
  });
}
