import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { sessionInput } from "../../../packages/contracts/src/index.js";
import { ApiError, actorFor, hashToken } from "./access.js";
import type { Database } from "./database.js";
import { getOnboarding, listOnboardings } from "./queries.js";
import * as s from "./schema.js";
import { demoNow } from "./seed.js";

export async function createApp(
  db: Database,
  options: { demo: boolean; now?: () => Date; logger?: boolean },
) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 10_000 });
  const now = options.now ?? (() => new Date(demoNow));
  await app.register(cookie);
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof ApiError ? error.statusCode : 500;
    if (status === 500) app.log.error(error);
    return reply.code(status).send({
      message:
        status === 500
          ? "The request could not be completed. Try again."
          : error instanceof Error
            ? error.message
            : "Request failed",
    });
  });
  app.addHook("onRequest", async (request) => {
    if (request.method === "GET" || request.method === "HEAD") return;
    const origin = request.headers.origin;
    if (
      origin &&
      ![
        `http://127.0.0.1:${process.env.UI_PORT ?? 4310}`,
        `http://127.0.0.1:${process.env.API_PORT ?? 4311}`,
      ].includes(origin)
    )
      throw new ApiError(403, "This action must start from the local application.");
  });
  app.get("/api/health", async () => {
    await db.execute("select 1");
    return { status: "ready" };
  });
  app.get("/api/demo/personas", async () => {
    if (!options.demo) throw new ApiError(404, "Demo personas are unavailable.");
    return db
      .select({
        id: s.memberships.id,
        name: s.users.name,
        role: s.memberships.role,
        workspaceName: s.workspaces.name,
      })
      .from(s.memberships)
      .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
      .innerJoin(s.workspaces, eq(s.workspaces.id, s.memberships.workspaceId));
  });
  app.post("/api/demo/session", async (request, reply) => {
    if (!options.demo) throw new ApiError(404, "Demo personas are unavailable.");
    const input = sessionInput(request.body);
    if (input instanceof type.errors) throw new ApiError(400, input.summary);
    const [membership] = await db
      .select()
      .from(s.memberships)
      .where(eq(s.memberships.id, input.membershipId));
    if (!membership) throw new ApiError(404, "Demo persona not found.");
    if (request.cookies.relay_session)
      await db
        .delete(s.sessions)
        .where(eq(s.sessions.tokenHash, hashToken(request.cookies.relay_session)));
    const token = randomBytes(32).toString("base64url");
    await db.insert(s.sessions).values({
      tokenHash: hashToken(token),
      membershipId: membership.id,
      expiresAt: new Date(now().getTime() + 86_400_000).toISOString(),
    });
    reply.setCookie("relay_session", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86_400,
    });
    return { ok: true };
  });
  app.get("/api/session", async (request) => actorFor(db, request, now()));
  app.get("/api/onboardings", async (request) =>
    listOnboardings(db, await actorFor(db, request, now())),
  );
  app.get<{ Params: { id: string } }>("/api/onboardings/:id", async (request) =>
    getOnboarding(db, await actorFor(db, request, now()), request.params.id),
  );
  return app;
}
