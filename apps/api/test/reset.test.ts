import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { assertDemoDatabase } from "../src/reset.js";
import { demoIdentity } from "../src/schema.js";
import { seedDatabase } from "../src/seed.js";

const url = process.env.DATABASE_URL;
if (!url || process.env.APP_ENV !== "demo" || !process.env.DEMO_RUN_ID)
  throw new Error("Use the disposable verification runner");
const { db, client } = connectDatabase(url);
before(async () => {
  await migrateDatabase(db);
  await seedDatabase(db);
});
after(async () => {
  await client.end();
});

test("reset requires explicit demo mode and a verified database identity", async () => {
  await assert.rejects(assertDemoDatabase(db, false), /explicit recorded demo/);
  await assert.doesNotReject(assertDemoDatabase(db, true));
  await db.transaction(async (tx) => {
    await tx.delete(demoIdentity);
    await assert.rejects(assertDemoDatabase(tx, true), /marker is missing/);
    await tx.insert(demoIdentity).values({ id: "customer-onboarding-disposable-v1" });
  });
  // This negative target is created only inside the task's disposable PostgreSQL container.
  const probeName = "customer_onboarding_guard_probe";
  await client.unsafe(`create database ${probeName}`);
  const probeUrl = new URL(url);
  probeUrl.pathname = `/${probeName}`;
  const probe = connectDatabase(probeUrl.toString());
  try {
    await migrateDatabase(probe.db);
    await seedDatabase(probe.db);
    await assert.rejects(assertDemoDatabase(probe.db, true), /database identity does not match/);
  } finally {
    await probe.client.end();
    await client.unsafe(`drop database ${probeName}`);
  }
});
