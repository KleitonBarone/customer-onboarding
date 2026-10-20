import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import {
  activateInput,
  reopenInput,
  reviewInput,
  sessionInput,
  submissionInput,
  versionInput,
} from "../../../packages/contracts/src/index.js";
import { ApiError, actorFor, hashToken, onboardingFor } from "./access.js";
import { changeActivation } from "./activation.js";
import type { Database } from "./database.js";
import { downloadFile, uploadFile } from "./files.js";
import { getOnboarding, listOnboardings } from "./queries.js";
import { reviewRequirement } from "./reviews.js";
import * as s from "./schema.js";
import { demoNow } from "./seed.js";
import { submitContent } from "./submissions.js";

export async function createApp(
  db: Database,
  options: { demo: boolean; now?: () => Date; logger?: boolean; storageRoot?: string },
) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 10_000 });
  const now = options.now ?? (() => new Date(demoNow));
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof ApiError
        ? error.statusCode
        : error instanceof Error &&
            "statusCode" in error &&
            typeof error.statusCode === "number" &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ? error.statusCode
          : 500;
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
        `http://localhost:${process.env.UI_PORT ?? 4310}`,
        `http://localhost:${process.env.API_PORT ?? 4311}`,
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
  app.post<{ Params: { id: string; requirementId: string } }>(
    "/api/onboardings/:id/requirements/:requirementId/submissions",
    async (request) => {
      const actor = await actorFor(db, request, now());
      const input = submissionInput(request.body);
      if (input instanceof type.errors) throw new ApiError(400, input.summary);
      const content =
        input.kind === "company"
          ? `${input.legalName.trim()}\n${input.registeredAddress.trim()}`
          : `${input.name.trim()}\n${input.email.trim()}`;
      const complete =
        input.kind === "company"
          ? input.legalName.trim() && input.registeredAddress.trim()
          : input.name.trim() && input.email.trim();
      if (!complete) throw new ApiError(400, "Complete every requested field.");
      return submitContent(
        db,
        actor,
        request.params.id,
        request.params.requirementId,
        { content, version: input.version, kind: input.kind },
        now(),
      );
    },
  );
  app.post<{ Params: { id: string; requirementId: string }; Querystring: { version?: string } }>(
    "/api/onboardings/:id/requirements/:requirementId/files",
    async (request) => {
      const actor = await actorFor(db, request, now());
      await onboardingFor(db, actor, request.params.id);
      if (actor.role !== "customer")
        throw new ApiError(403, "Only the assigned customer can upload a document.");
      const version = versionInput(Number(request.query.version));
      if (version instanceof type.errors)
        throw new ApiError(400, "A current requirement version is required.");
      if (!options.storageRoot) throw new ApiError(503, "Local file storage is unavailable.");
      const file = await request.file();
      if (!file) throw new ApiError(400, "Choose a document to upload.");
      return uploadFile(
        db,
        actor,
        request.params.id,
        request.params.requirementId,
        version,
        file,
        options.storageRoot,
        now(),
      );
    },
  );
  app.get<{ Params: { id: string } }>("/api/revisions/:id/file", async (request, reply) => {
    const actor = await actorFor(db, request, now());
    if (!options.storageRoot) throw new ApiError(503, "Local file storage is unavailable.");
    const file = await downloadFile(db, actor, request.params.id, options.storageRoot);
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      )
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store")
      .type(file.mediaType)
      .send(file.bytes);
  });
  app.post<{ Params: { id: string; requirementId: string } }>(
    "/api/onboardings/:id/requirements/:requirementId/reviews",
    async (request) => {
      const actor = await actorFor(db, request, now());
      const input = reviewInput(request.body);
      if (input instanceof type.errors) throw new ApiError(400, input.summary);
      return reviewRequirement(
        db,
        actor,
        request.params.id,
        request.params.requirementId,
        input,
        now(),
      );
    },
  );
  app.post<{ Params: { id: string } }>("/api/onboardings/:id/activate", async (request) => {
    const actor = await actorFor(db, request, now());
    const input = activateInput(request.body);
    if (input instanceof type.errors) throw new ApiError(400, input.summary);
    return changeActivation(db, actor, request.params.id, input.version, "activate", now());
  });
  app.post<{ Params: { id: string } }>("/api/onboardings/:id/reopen", async (request) => {
    const actor = await actorFor(db, request, now());
    const input = reopenInput(request.body);
    if (input instanceof type.errors) throw new ApiError(400, input.summary);
    return changeActivation(
      db,
      actor,
      request.params.id,
      input.version,
      "reopen",
      now(),
      input.reason,
    );
  });
  return app;
}
