import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { and, eq } from "drizzle-orm";
import type { Actor } from "../../../packages/contracts/src/index.js";
import { ApiError, onboardingFor } from "./access.js";
import type { Database } from "./database.js";
import * as s from "./schema.js";
import { submitContent } from "./submissions.js";

export async function uploadFile(
  db: Database,
  actor: Actor,
  onboardingId: string,
  requirementId: string,
  version: number,
  file: MultipartFile,
  storageRoot: string,
  now: Date,
) {
  await onboardingFor(db, actor, onboardingId);
  if (actor.role !== "customer")
    throw new ApiError(403, "Only the assigned customer can upload a document.");
  const [requirement] = await db
    .select()
    .from(s.requirements)
    .where(
      and(eq(s.requirements.id, requirementId), eq(s.requirements.onboardingId, onboardingId)),
    );
  if (!requirement) throw new ApiError(404, "Requirement not found.");
  const bytes = await file.toBuffer();
  const fileName = file.filename
    .replace(/^.*[\\/]/, "")
    .replace(/\p{Cc}/gu, "")
    .slice(0, 160);
  let mediaType: string;
  if (
    requirement.kind === "agreement" &&
    fileName.toLowerCase().endsWith(".pdf") &&
    bytes.subarray(0, 5).toString() === "%PDF-"
  )
    mediaType = "application/pdf";
  else if (
    requirement.kind === "import" &&
    fileName.toLowerCase().endsWith(".csv") &&
    bytes.length > 0
  ) {
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError(400, "Upload a UTF-8 CSV sample.");
    }
    if (content.includes("\0") || !content.includes(","))
      throw new ApiError(
        400,
        "Upload a UTF-8 CSV sample with a header and comma-separated columns.",
      );
    mediaType = "text/csv";
  } else
    throw new ApiError(
      400,
      requirement.kind === "agreement"
        ? "Upload a PDF agreement, up to 2 MiB."
        : "Upload a UTF-8 CSV sample, up to 2 MiB.",
    );
  const storageId = randomUUID();
  await mkdir(storageRoot, { recursive: true });
  const target = path.join(storageRoot, storageId);
  await writeFile(target, bytes, { flag: "wx" });
  try {
    return await submitContent(
      db,
      actor,
      onboardingId,
      requirementId,
      { content: fileName, version },
      now,
      { storageId, fileName, mediaType, size: bytes.length },
    );
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}

export async function downloadFile(
  db: Database,
  actor: Actor,
  revisionId: string,
  storageRoot: string,
) {
  const [record] = await db
    .select({ revision: s.revisions, onboardingId: s.requirements.onboardingId })
    .from(s.revisions)
    .innerJoin(s.requirements, eq(s.requirements.id, s.revisions.requirementId))
    .where(eq(s.revisions.id, revisionId));
  if (!record) throw new ApiError(404, "Document not found.");
  await onboardingFor(db, actor, record.onboardingId);
  const { revision } = record;
  if (
    !revision.storageId ||
    !revision.fileName ||
    !revision.mediaType ||
    !/^[a-f0-9-]{36}$/.test(revision.storageId)
  )
    throw new ApiError(404, "Document not found.");
  try {
    return {
      bytes: await readFile(path.join(storageRoot, revision.storageId)),
      fileName: revision.fileName,
      mediaType: revision.mediaType,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      throw new ApiError(
        404,
        "This local demo file is unavailable. Reset the demo to restore fixtures.",
      );
    throw error;
  }
}
