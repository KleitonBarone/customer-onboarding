import type { Database } from "./database.js";
import * as s from "./schema.js";
import { additionalPersonas, scenarioAccounts, seedScenario } from "./seed-scenarios.js";

export const demoNow = "2026-10-15T12:00:00.000Z";
export const personaSeeds = [
  {
    id: "ada",
    name: "Ada Wells",
    email: "ada@example.test",
    workspaceId: "northstar",
    role: "manager",
  },
  {
    id: "noah",
    name: "Noah Ellis",
    email: "noah@example.test",
    workspaceId: "northstar",
    role: "reviewer",
  },
  {
    id: "maya",
    name: "Maya Chen",
    email: "maya@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "owen",
    name: "Owen Reed",
    email: "owen@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "iris",
    name: "Iris Park",
    email: "iris@example.test",
    workspaceId: "elsewhere",
    role: "manager",
  },
  {
    id: "leo",
    name: "Leo Silva",
    email: "leo@example.test",
    workspaceId: "elsewhere",
    role: "customer",
  },
  ...additionalPersonas,
] as const;

export const requirementSeeds = [
  { kind: "company", title: "Company details" },
  { kind: "agreement", title: "Service agreement" },
  { kind: "import", title: "Sample import file" },
  { kind: "contact", title: "Launch contact" },
] as const;

export async function seedDatabase(db: Pick<Database, "transaction">, storageRoot?: string) {
  await db.transaction(async (tx) => {
    await tx
      .insert(s.demoIdentity)
      .values({ id: "customer-onboarding-disposable-v1" })
      .onConflictDoNothing();
    await tx
      .insert(s.workspaces)
      .values([
        { id: "northstar", name: "Northstar Analytics" },
        { id: "elsewhere", name: "Elsewhere Metrics" },
      ])
      .onConflictDoNothing();
    await tx
      .insert(s.users)
      .values(personaSeeds.map(({ id, name, email }) => ({ id, name, email })))
      .onConflictDoNothing();
    await tx
      .insert(s.memberships)
      .values(
        personaSeeds.map(({ id, workspaceId, role }) => ({ id, userId: id, workspaceId, role })),
      )
      .onConflictDoNothing();
    const accounts = scenarioAccounts;
    for (const config of accounts) {
      const account = {
        id: config.id,
        name: config.name,
        workspaceId: config.workspaceId,
        ownerId: config.ownerId,
      };
      const member = config.member;
      await tx.insert(s.customerAccounts).values(account).onConflictDoNothing();
      await tx
        .insert(s.customerMemberships)
        .values({ id: `${account.id}-${member}`, customerId: account.id, membershipId: member })
        .onConflictDoNothing();
      const inserted = await tx
        .insert(s.onboardings)
        .values({ id: account.id, customerId: account.id, createdAt: config.createdAt })
        .onConflictDoNothing()
        .returning({ id: s.onboardings.id });
      await tx
        .insert(s.requirements)
        .values(
          requirementSeeds.map((requirement) => ({
            id: `${account.id}-${requirement.kind}`,
            onboardingId: account.id,
            ...requirement,
          })),
        )
        .onConflictDoNothing();
      if (inserted.length) await seedScenario(tx, config, storageRoot);
    }
  });
}
