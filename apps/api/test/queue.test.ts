import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { onboardingsSchema, personasSchema } from "../../../packages/contracts/src/index.js";
import { requireRunContext } from "../../../scripts/run-context.js";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { seedDatabase } from "../src/seed.js";
import { fixtureOnboarding, login } from "./helpers.js";

const { url } = await requireRunContext("verify");
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

async function queue(cookie: string, query: string) {
  const response = await app.inject({ url: `/api/onboardings?${query}`, headers: { cookie } });
  assert.equal(response.statusCode, 200, response.body);
  return onboardingsSchema.assert(response.json());
}

test("queue filters agree with derived states and stay within customer/workspace boundaries", async () => {
  const manager = await login(app, "ada");
  for (const [status, search, id] of [
    ["draft", "Beacon", "beacon"],
    ["in_progress", "Juniper", "juniper"],
    ["ready", "Cedar", "cedar"],
    ["active", "Lumen", "lumen"],
  ]) {
    const records = await queue(manager, `status=${status}&search=${search}`);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.id, id);
    assert.equal(records[0]?.status, status);
  }
  const correction = await queue(manager, "search=Juniper");
  assert.equal(correction[0]?.ageDays, 5);
  assert.equal(correction[0]?.nextAction, "Customer to correct service agreement");
  const personas = personasSchema.assert((await app.inject("/api/demo/personas")).json());
  const owner = personas.find((persona) => persona.name === "Oliver Grant");
  assert.ok(owner);
  assert.equal(owner.userId, "oliver");
  assert.notEqual(owner.id, owner.userId);
  assert.deepEqual(
    (await queue(manager, `ownerId=${owner.userId}`)).map((item) => item.id).sort(),
    ["cedar", "lumen"],
  );
  assert.deepEqual(await queue(manager, "search=Westhaven"), []);
  assert.deepEqual(await queue(await login(app, "maya"), "search=Cedar"), []);
  assert.deepEqual(await queue(await login(app, "iris"), "search=Juniper"), []);
  for (const query of [
    "limit=51",
    "offset=-1",
    "status=unknown",
    `search=${"a".repeat(81)}`,
    "workspaceId=elsewhere",
  ])
    assert.equal(
      (await app.inject({ url: `/api/onboardings?${query}`, headers: { cookie: manager } }))
        .statusCode,
      400,
    );
});

test("queue pagination is stable and bounded", async () => {
  await fixtureOnboarding(db, "filter-probe-one");
  await fixtureOnboarding(db, "filter-probe-two");
  const manager = await login(app, "ada");
  const first = await queue(manager, "search=filter-probe&limit=1&offset=0");
  const second = await queue(manager, "search=filter-probe&limit=1&offset=1");
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.notEqual(first[0]?.id, second[0]?.id);
  assert.deepEqual(first, await queue(manager, "search=filter-probe&limit=1&offset=0"));
  assert.deepEqual(await queue(await login(app, "owen"), "search=filter-probe"), []);
});
