import type { Database } from "./database.js";
import * as s from "./schema.js";

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
] as const;

export const requirementSeeds = [
  { kind: "company", title: "Company details" },
  { kind: "agreement", title: "Service agreement" },
  { kind: "import", title: "Sample import file" },
  { kind: "contact", title: "Launch contact" },
] as const;

export async function seedDatabase(db: Database) {
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
    const accounts = [
      {
        id: "juniper",
        name: "Juniper Retail",
        workspaceId: "northstar",
        ownerId: "ada",
        member: "maya",
      },
      {
        id: "beacon",
        name: "Beacon Supply",
        workspaceId: "northstar",
        ownerId: "ada",
        member: "owen",
      },
      {
        id: "westhaven",
        name: "Westhaven Stores",
        workspaceId: "elsewhere",
        ownerId: "iris",
        member: "leo",
      },
    ];
    for (const { member, ...account } of accounts) {
      await tx.insert(s.customerAccounts).values(account).onConflictDoNothing();
      await tx
        .insert(s.customerMemberships)
        .values({ id: `${account.id}-${member}`, customerId: account.id, membershipId: member })
        .onConflictDoNothing();
      await tx
        .insert(s.onboardings)
        .values({ id: account.id, customerId: account.id, createdAt: "2026-10-12T09:00:00.000Z" })
        .onConflictDoNothing();
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
    }
  });
}
