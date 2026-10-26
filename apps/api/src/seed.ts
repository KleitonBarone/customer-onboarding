import {
  demoNow,
  personaSeeds,
  requirementSeeds,
  scenarioAccounts,
  workspaceSeeds,
} from "../../../packages/contracts/src/demo.js";

export { demoNow, personaSeeds, requirementSeeds } from "../../../packages/contracts/src/demo.js";

import type { Database } from "./database.js";
import * as s from "./schema.js";
import { seedScenario } from "./seed-scenarios.js";

export async function seedDatabase(db: Pick<Database, "transaction">, storageRoot?: string) {
  await db.transaction(async (tx) => {
    await tx
      .insert(s.demoIdentity)
      .values({ id: "customer-onboarding-disposable-v1" })
      .onConflictDoNothing();
    await tx
      .insert(s.workspaces)
      .values([...workspaceSeeds])
      .onConflictDoNothing();
    await tx
      .insert(s.users)
      .values(personaSeeds.map(({ id, name, email }) => ({ id, name, email })))
      .onConflictDoNothing();
    await tx
      .insert(s.memberships)
      .values(
        personaSeeds.map((persona) => ({
          id: "membershipId" in persona ? persona.membershipId : persona.id,
          userId: persona.id,
          workspaceId: persona.workspaceId,
          role: persona.role,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.demoClocks)
      .values([
        { workspaceId: "northstar", now: demoNow },
        { workspaceId: "elsewhere", now: demoNow },
      ])
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
