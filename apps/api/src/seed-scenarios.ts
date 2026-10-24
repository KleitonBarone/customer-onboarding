import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Database } from "./database.js";
import * as s from "./schema.js";

export const additionalPersonas = [
  {
    id: "oliver",
    membershipId: "northstar-oliver",
    name: "Oliver Grant",
    email: "oliver@example.test",
    workspaceId: "northstar",
    role: "manager",
  },
  {
    id: "tessa",
    name: "Tessa Brooks",
    email: "tessa@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "eli",
    name: "Eli Morgan",
    email: "eli@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "jules",
    name: "Jules Bennett",
    email: "jules@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
] as const;

export const scenarioAccounts = [
  {
    id: "juniper",
    name: "Juniper Retail",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "maya",
    scenario: "changes_requested",
    createdAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "beacon",
    name: "Beacon Supply",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "owen",
    scenario: "missing",
    createdAt: "2026-10-14T09:00:00.000Z",
  },
  {
    id: "atlas",
    name: "Atlas Goods",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "tessa",
    scenario: "submitted",
    createdAt: "2026-10-12T09:00:00.000Z",
  },
  {
    id: "cedar",
    name: "Cedar & Co",
    workspaceId: "northstar",
    ownerId: "oliver",
    member: "eli",
    scenario: "ready",
    createdAt: "2026-10-08T09:00:00.000Z",
  },
  {
    id: "lumen",
    name: "Lumen Home",
    workspaceId: "northstar",
    ownerId: "oliver",
    member: "jules",
    scenario: "active",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "westhaven",
    name: "Westhaven Stores",
    workspaceId: "elsewhere",
    ownerId: "iris",
    member: "leo",
    scenario: "missing",
    createdAt: "2026-10-13T09:00:00.000Z",
  },
] as const;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function seedScenario(
  tx: Transaction,
  account: (typeof scenarioAccounts)[number],
  storageRoot?: string,
) {
  const timestamp = (minutes: number) =>
    new Date(new Date(account.createdAt).getTime() + minutes * 60_000).toISOString();
  await tx.insert(s.activity).values({
    id: `${account.id}-created`,
    onboardingId: account.id,
    actorId: account.ownerId,
    message: "Created onboarding",
    createdAt: account.createdAt,
  });
  if (account.scenario === "missing") return;
  const [member] = await tx.select().from(s.users).where(eq(s.users.id, account.member));
  if (!member) throw new Error("Seed customer member is missing");
  const checklist = await tx
    .select()
    .from(s.requirements)
    .where(eq(s.requirements.onboardingId, account.id));
  checklist.sort(
    (a, b) =>
      s.requirementKind.enumValues.indexOf(a.kind) - s.requirementKind.enumValues.indexOf(b.kind),
  );
  for (const [index, requirement] of checklist.entries()) {
    const revisionId = `${account.id}-${requirement.kind}-seed-1`;
    let file: { storageId: string; fileName: string; mediaType: string; size: number } | undefined;
    const content =
      requirement.kind === "company"
        ? `${account.name} Ltd\n145 Orchard Avenue, Bristol`
        : requirement.kind === "contact"
          ? `${member.name}\n${member.email}`
          : requirement.kind === "agreement"
            ? "service-agreement.pdf"
            : "sample-import.csv";
    if (requirement.kind === "agreement" || requirement.kind === "import") {
      const bytes = await readFile(path.resolve("fixtures", content));
      const hash = createHash("sha256").update(revisionId).digest("hex");
      const storageId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
      file = {
        storageId,
        fileName: content,
        mediaType: requirement.kind === "agreement" ? "application/pdf" : "text/csv",
        size: bytes.length,
      };
      if (storageRoot) {
        await mkdir(storageRoot, { recursive: true });
        await writeFile(path.join(storageRoot, storageId), bytes);
      }
    }
    await tx.insert(s.revisions).values({
      id: revisionId,
      requirementId: requirement.id,
      content,
      actorId: account.member,
      createdAt: timestamp(60 + index * 20),
      ...file,
    });
    await tx.insert(s.activity).values({
      id: `${revisionId}-submitted`,
      onboardingId: account.id,
      actorId: account.member,
      message: `Submitted ${requirement.title.toLowerCase()}`,
      createdAt: timestamp(60 + index * 20),
    });
    const state =
      account.scenario === "submitted"
        ? "submitted"
        : account.scenario === "changes_requested" && requirement.kind === "agreement"
          ? "changes_requested"
          : "approved";
    await tx
      .update(s.requirements)
      .set({ currentRevisionId: revisionId, state, version: state === "submitted" ? 1 : 2 })
      .where(eq(s.requirements.id, requirement.id));
    if (state !== "submitted") {
      const reason = state === "changes_requested" ? "Include the signed final page." : "";
      await tx.insert(s.reviews).values({
        id: `${revisionId}-review`,
        revisionId,
        actorId: "noah",
        decision: state,
        reason,
        createdAt: timestamp(70 + index * 20),
      });
      await tx.insert(s.activity).values({
        id: `${revisionId}-reviewed`,
        onboardingId: account.id,
        actorId: "noah",
        message:
          state === "approved"
            ? `Approved ${requirement.title.toLowerCase()}`
            : `Requested correction for ${requirement.title.toLowerCase()}: ${reason}`,
        createdAt: timestamp(70 + index * 20),
      });
    }
  }
  await tx
    .update(s.onboardings)
    .set({
      startedAt: timestamp(30),
      activeAt: account.scenario === "active" ? timestamp(180) : null,
      version: account.scenario === "submitted" ? 4 : account.scenario === "active" ? 9 : 8,
    })
    .where(eq(s.onboardings.id, account.id));
  if (account.scenario === "active")
    await tx.insert(s.activity).values({
      id: `${account.id}-activated`,
      onboardingId: account.id,
      actorId: account.ownerId,
      message: "Activated account",
      createdAt: timestamp(180),
    });
}
