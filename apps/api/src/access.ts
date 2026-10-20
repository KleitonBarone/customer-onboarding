import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { Actor } from "../../../packages/contracts/src/index.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function actorFor(db: Database, request: FastifyRequest, now: Date) {
  const token = request.cookies.relay_session;
  if (!token) throw new ApiError(401, "Choose a demo persona to continue.");
  const [actor] = await db
    .select({
      membershipId: s.memberships.id,
      userId: s.users.id,
      name: s.users.name,
      role: s.memberships.role,
      workspaceId: s.workspaces.id,
      workspaceName: s.workspaces.name,
    })
    .from(s.sessions)
    .innerJoin(s.memberships, eq(s.memberships.id, s.sessions.membershipId))
    .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.memberships.workspaceId))
    .where(
      and(eq(s.sessions.tokenHash, hashToken(token)), gt(s.sessions.expiresAt, now.toISOString())),
    );
  if (!actor) throw new ApiError(401, "Your demo session expired. Choose a persona again.");
  return actor;
}

export async function onboardingFor(db: Database, actor: Actor, id: string) {
  const [record] = await db
    .select({ onboarding: s.onboardings, account: s.customerAccounts })
    .from(s.onboardings)
    .innerJoin(s.customerAccounts, eq(s.customerAccounts.id, s.onboardings.customerId))
    .where(and(eq(s.onboardings.id, id), eq(s.customerAccounts.workspaceId, actor.workspaceId)));
  if (!record) throw new ApiError(404, "Onboarding not found for this account.");
  if (actor.role === "customer") {
    const [membership] = await db
      .select()
      .from(s.customerMemberships)
      .where(
        and(
          eq(s.customerMemberships.membershipId, actor.membershipId),
          eq(s.customerMemberships.customerId, record.account.id),
        ),
      );
    if (!membership) throw new ApiError(404, "Onboarding not found for this account.");
  }
  return record;
}
