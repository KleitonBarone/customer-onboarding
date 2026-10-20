import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { notificationsSchema } from "../../../packages/contracts/src/index.js";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { deliverReminders, enqueueReminders } from "../src/reminders.js";
import * as s from "../src/schema.js";
import { demoNow, seedDatabase } from "../src/seed.js";
import { fixtureOnboarding, login } from "./helpers.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Run tests through pnpm verify");
const { db, client } = connectDatabase(url);
const app = await createApp(db, { demo: true });
before(async () => {
  await migrateDatabase(db);
  await seedDatabase(db);
});
after(async () => {
  await app.close();
  await client.end();
});

async function outbox(id: string) {
  return db.select().from(s.notificationOutbox).where(eq(s.notificationOutbox.onboardingId, id));
}
async function inbox(cookie: string) {
  const response = await app.inject({ url: "/api/notifications", headers: { cookie } });
  assert.equal(response.statusCode, 200, response.body);
  return notificationsSchema.assert(response.json());
}

test("reminders deduplicate concurrent runs by UTC window and exclude non-customer work", async () => {
  const id = "reminder-pending";
  await fixtureOnboarding(db, id);
  await db.update(s.onboardings).set({ startedAt: demoNow }).where(eq(s.onboardings.id, id));
  const now = new Date(demoNow);
  await Promise.all(Array.from({ length: 3 }, () => enqueueReminders(db, "northstar", now)));
  assert.equal((await outbox(id)).length, 1);
  for (const excluded of ["beacon", "atlas", "cedar", "lumen", "westhaven"])
    assert.equal((await outbox(excluded)).length, 0, excluded);
  await enqueueReminders(db, "northstar", new Date("2026-10-15T23:59:59.999Z"));
  assert.equal((await outbox(id)).length, 1);
  await enqueueReminders(db, "northstar", new Date("2026-10-16T00:00:00.000Z"));
  assert.equal((await outbox(id)).length, 2);
  await Promise.all([deliverReminders(db, now), deliverReminders(db, now)]);
  await deliverReminders(db, now);
  const delivered = await db
    .select()
    .from(s.notificationInbox)
    .innerJoin(s.notificationOutbox, eq(s.notificationOutbox.id, s.notificationInbox.outboxId))
    .where(eq(s.notificationOutbox.onboardingId, id));
  assert.equal(delivered.length, 2);
  assert.ok((await outbox(id)).every((item) => item.deliveredAt));
});

test("a restarted API process recovers pending outbox rows without duplicate delivery", async () => {
  const id = "reminder-restart";
  await fixtureOnboarding(db, id);
  await db.update(s.onboardings).set({ startedAt: demoNow }).where(eq(s.onboardings.id, id));
  await enqueueReminders(db, "northstar", new Date(demoNow));
  assert.equal((await outbox(id))[0]?.deliveredAt, null);
  for (let restart = 0; restart < 2; restart++) {
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "apps/api/test/restart-worker.ts"],
      { timeout: 20_000, windowsHide: true },
    );
  }
  const rows = await db
    .select()
    .from(s.notificationInbox)
    .innerJoin(s.notificationOutbox, eq(s.notificationOutbox.id, s.notificationInbox.outboxId))
    .where(eq(s.notificationOutbox.onboardingId, id));
  assert.equal(rows.length, 1);
  assert.ok((await outbox(id))[0]?.deliveredAt);
});

test("inbox access and demo clocks follow workspace scope without expiring sessions", async () => {
  const manager = await login(app, "ada");
  const customer = await login(app, "maya");
  assert.ok((await inbox(customer)).some((item) => item.onboardingId === "juniper"));
  assert.deepEqual(await inbox(await login(app, "owen")), []);
  assert.deepEqual(await inbox(await login(app, "iris")), []);
  assert.equal((await app.inject("/api/notifications")).statusCode, 401);
  const advance = (cookie: string, payload: Record<string, unknown> = {}) =>
    app.inject({ method: "POST", url: "/api/demo/clock/advance", headers: { cookie }, payload });
  assert.equal((await advance(customer)).statusCode, 403);
  assert.equal((await advance(manager, { workspaceId: "elsewhere" })).statusCode, 400);
  try {
    assert.equal((await advance(manager)).statusCode, 200);
    assert.equal((await advance(manager)).statusCode, 200);
    assert.equal(
      (await app.inject({ url: "/api/session", headers: { cookie: customer } })).statusCode,
      200,
    );
    const other = await db
      .select()
      .from(s.demoClocks)
      .where(eq(s.demoClocks.workspaceId, "elsewhere"));
    assert.equal(new Date(other[0]?.now ?? "").toISOString(), demoNow);
  } finally {
    await db
      .update(s.demoClocks)
      .set({ now: demoNow })
      .where(eq(s.demoClocks.workspaceId, "northstar"));
  }
  assert.equal((await outbox("juniper")).filter((item) => item.window === "2026-10-15").length, 1);
});
