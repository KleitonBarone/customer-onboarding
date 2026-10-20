import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  actorSchema,
  detailSchema,
  onboardingsSchema,
} from "../../../packages/contracts/src/index.js";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { seedDatabase } from "../src/seed.js";

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

async function session(membershipId: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/demo/session",
    payload: { membershipId },
  });
  assert.equal(response.statusCode, 200, response.body);
  const cookie = response.cookies.find((item) => item.name === "relay_session");
  assert.ok(cookie);
  return `relay_session=${cookie.value}`;
}

test("sessions derive role and workspace; clients cannot supply an actor", async () => {
  assert.equal((await app.inject("/api/session")).statusCode, 401);
  const cookie = await session("maya");
  const response = await app.inject({ url: "/api/session", headers: { cookie } });
  const actor = actorSchema.assert(response.json());
  assert.equal(actor.userId, "maya");
  assert.equal(actor.role, "customer");
  assert.equal(actor.workspaceId, "northstar");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/demo/session",
        payload: { membershipId: "maya", role: "manager" },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/demo/session",
        headers: { origin: "https://unrelated.example" },
        payload: { membershipId: "ada" },
      })
    ).statusCode,
    403,
  );
});

test("customers see only assigned onboarding identifiers and workspace employees stay scoped", async () => {
  const cookie = await session("maya");
  const list = onboardingsSchema.assert(
    (await app.inject({ url: "/api/onboardings", headers: { cookie } })).json(),
  );
  assert.deepEqual(
    list.map((item) => item.id),
    ["juniper"],
  );
  const detail = detailSchema.assert(
    (await app.inject({ url: "/api/onboardings/juniper", headers: { cookie } })).json(),
  );
  assert.equal(detail.requirements.length, 4);
  for (const id of ["beacon", "westhaven", "unknown"])
    assert.equal(
      (await app.inject({ url: `/api/onboardings/${id}`, headers: { cookie } })).statusCode,
      404,
    );
  const manager = await session("ada");
  const employees = onboardingsSchema.assert(
    (await app.inject({ url: "/api/onboardings", headers: { cookie: manager } })).json(),
  );
  assert.deepEqual(
    employees.map((item) => item.id),
    ["beacon", "juniper"],
  );
  assert.equal(
    (await app.inject({ url: "/api/onboardings/westhaven", headers: { cookie: manager } }))
      .statusCode,
    404,
  );
});

test("the persona picker is unavailable outside explicit demo mode", async () => {
  const restricted = await createApp(db, { demo: false });
  try {
    assert.equal((await restricted.inject("/api/demo/personas")).statusCode, 404);
    assert.equal(
      (
        await restricted.inject({
          method: "POST",
          url: "/api/demo/session",
          payload: { membershipId: "ada" },
        })
      ).statusCode,
      404,
    );
  } finally {
    await restricted.close();
  }
});
