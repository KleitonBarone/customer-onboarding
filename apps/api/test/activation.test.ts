import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { requireRunContext } from "../../../scripts/run-context.js";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import * as s from "../src/schema.js";
import { demoNow, requirementSeeds, seedDatabase } from "../src/seed.js";
import { detail, fixtureOnboarding, login, upload } from "./helpers.js";

const { url, storageRoot } = await requireRunContext("verify");
const { db, client } = connectDatabase(url);
const app = await createApp(db, { demo: true, storageRoot });
before(async () => {
  await migrateDatabase(db);
  await seedDatabase(db);
});
after(async () => {
  await app.close();
  await client.end();
});

async function readyFixture(id: string) {
  await fixtureOnboarding(db, id);
  for (const requirement of requirementSeeds) {
    const revisionId = `${id}-${requirement.kind}-revision`;
    await db.insert(s.revisions).values({
      id: revisionId,
      requirementId: `${id}-${requirement.kind}`,
      content: "Approved synthetic evidence",
      actorId: "maya",
      createdAt: demoNow,
    });
    await db.insert(s.reviews).values({
      id: `${revisionId}-review`,
      revisionId,
      actorId: "noah",
      decision: "approved",
      reason: "",
      createdAt: demoNow,
    });
    await db
      .update(s.requirements)
      .set({ state: "approved", currentRevisionId: revisionId, version: 2 })
      .where(eq(s.requirements.id, `${id}-${requirement.kind}`));
  }
  await db
    .update(s.onboardings)
    .set({ startedAt: demoNow, version: 8 })
    .where(eq(s.onboardings.id, id));
}

test("activation checks roles, workspace, and every mandatory approval without side effects", async () => {
  const id = "activation-blocked";
  await fixtureOnboarding(db, id);
  for (const persona of ["maya", "noah"])
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/onboardings/${id}/activate`,
          headers: { cookie: await login(app, persona) },
          payload: { version: 0 },
        })
      ).statusCode,
      403,
    );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/activate`,
        headers: { cookie: await login(app, "iris") },
        payload: { version: 0 },
      })
    ).statusCode,
    404,
  );
  const manager = await login(app, "ada");
  const response = await app.inject({
    method: "POST",
    url: `/api/onboardings/${id}/activate`,
    headers: { cookie: manager },
    payload: { version: 0 },
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.equal((await detail(app, manager, id)).activity.length, 0);
});

test("active edits are blocked until a manager explicitly reopens with an audited reason", async () => {
  const id = "activation-reopen";
  await readyFixture(id);
  const manager = await login(app, "ada");
  const customer = await login(app, "maya");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/activate`,
        headers: { cookie: manager },
        payload: { version: 8 },
      })
    ).statusCode,
    200,
  );
  const active = await detail(app, manager, id);
  assert.equal(active.onboarding.status, "active");
  const payload = {
    kind: "company",
    legalName: "Updated retailer",
    registeredAddress: "42 New Street",
    version: 2,
  };
  const submit = () =>
    app.inject({
      method: "POST",
      url: `/api/onboardings/${id}/requirements/${id}-company/submissions`,
      headers: { cookie: customer },
      payload,
    });
  assert.equal((await submit()).statusCode, 409);
  assert.equal(
    (
      await upload(
        app,
        customer,
        `${id}-agreement`,
        2,
        Buffer.from("%PDF-1.4\nBlocked\n%%EOF"),
        "blocked.pdf",
        id,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/reopen`,
        headers: { cookie: manager },
        payload: { version: 8, reason: "Update company details" },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/reopen`,
        headers: { cookie: manager },
        payload: { version: active.onboarding.version, reason: " " },
      })
    ).statusCode,
    400,
  );
  assert.equal((await detail(app, manager, id)).activity.length, 1);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/reopen`,
        headers: { cookie: manager },
        payload: { version: active.onboarding.version, reason: "Update company details" },
      })
    ).statusCode,
    200,
  );
  const reopened = await detail(app, manager, id);
  assert.equal(reopened.onboarding.status, "ready");
  assert.equal(reopened.activity[0]?.message, "Reopened onboarding: Update company details");
  assert.equal(reopened.activity[0]?.actor, "Ada Wells");
  assert.equal((await submit()).statusCode, 200);
  const updated = await detail(app, manager, id);
  assert.equal(updated.onboarding.status, "in_progress");
  assert.equal(updated.requirements.find((item) => item.kind === "company")?.state, "submitted");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/onboardings/${id}/activate`,
        headers: { cookie: manager },
        payload: { version: updated.onboarding.version },
      })
    ).statusCode,
    409,
  );
});

test("activation racing a replacement never leaves an active account with unapproved current material", async () => {
  const id = "activation-race";
  await readyFixture(id);
  const manager = await login(app, "ada");
  const customer = await login(app, "maya");
  const responses = await Promise.all([
    app.inject({
      method: "POST",
      url: `/api/onboardings/${id}/activate`,
      headers: { cookie: manager },
      payload: { version: 8 },
    }),
    app.inject({
      method: "POST",
      url: `/api/onboardings/${id}/requirements/${id}-company/submissions`,
      headers: { cookie: customer },
      payload: {
        kind: "company",
        legalName: "Replacement",
        registeredAddress: "Replacement address",
        version: 2,
      },
    }),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  const final = await detail(app, manager, id);
  if (final.onboarding.status === "active")
    assert.ok(
      final.requirements.every((item) => item.state === "approved" && item.currentRevisionId),
    );
  else {
    assert.equal(final.onboarding.status, "in_progress");
    assert.equal(final.requirements.find((item) => item.kind === "company")?.state, "submitted");
  }
  assert.equal(final.activity.length, 1);
});
