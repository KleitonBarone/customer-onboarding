import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { requireRunContext } from "../../../scripts/run-context.js";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { seedDatabase } from "../src/seed.js";
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

test("corrections retain previous files/reviews and replacement approval never carries over", async () => {
  const fixtureId = "review-correction";
  await fixtureOnboarding(db, fixtureId);
  const endpoint = `/api/onboardings/${fixtureId}/requirements/${fixtureId}-agreement/reviews`;
  const customer = await login(app, "maya");
  const reviewer = await login(app, "noah");
  assert.equal(
    (
      await upload(
        app,
        customer,
        `${fixtureId}-agreement`,
        0,
        Buffer.from("%PDF-1.4\nOriginal\n%%EOF"),
        "original.pdf",
        fixtureId,
      )
    ).statusCode,
    200,
  );
  const original = (await detail(app, customer, fixtureId)).requirements.find(
    (item) => item.kind === "agreement",
  );
  assert.ok(original?.currentRevisionId);
  const input = {
    revisionId: original.currentRevisionId,
    version: original.version,
    decision: "changes_requested",
    reason: "",
  };
  for (const persona of ["maya", "ada"])
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: endpoint,
          headers: { cookie: await login(app, persona) },
          payload: input,
        })
      ).statusCode,
      403,
    );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: endpoint,
        headers: { cookie: reviewer },
        payload: input,
      })
    ).statusCode,
    400,
  );
  const requested = await app.inject({
    method: "POST",
    url: endpoint,
    headers: { cookie: reviewer },
    payload: { ...input, reason: "Include the signed final page." },
  });
  assert.equal(requested.statusCode, 200, requested.body);
  const correction = await detail(app, customer, fixtureId);
  const changed = correction.requirements.find((item) => item.id === original.id);
  assert.ok(changed);
  assert.equal(changed.state, "changes_requested");
  assert.equal(
    correction.reviews.find((item) => item.revisionId === original.currentRevisionId)?.reason,
    "Include the signed final page.",
  );
  const replacement = await upload(
    app,
    customer,
    changed.id,
    changed.version,
    Buffer.from("%PDF-1.4\nCorrected synthetic agreement\n%%EOF"),
    "corrected.pdf",
    fixtureId,
  );
  assert.equal(replacement.statusCode, 200, replacement.body);
  const pending = await detail(app, customer, fixtureId);
  const current = pending.requirements.find((item) => item.id === changed.id);
  assert.ok(current?.currentRevisionId);
  assert.equal(current.state, "submitted");
  assert.notEqual(current.currentRevisionId, original.currentRevisionId);
  assert.equal(
    (
      await app.inject({
        url: `/api/revisions/${original.currentRevisionId}/file`,
        headers: { cookie: customer },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: endpoint,
        headers: { cookie: reviewer },
        payload: { ...input, decision: "approved" },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: endpoint,
        headers: { cookie: reviewer },
        payload: {
          revisionId: current.currentRevisionId,
          version: current.version,
          decision: "approved",
          reason: "",
        },
      })
    ).statusCode,
    200,
  );
  const approved = (await detail(app, customer, fixtureId)).requirements.find(
    (item) => item.id === changed.id,
  );
  assert.ok(approved);
  assert.equal(approved.state, "approved");
  assert.equal(
    (
      await upload(
        app,
        customer,
        approved.id,
        approved.version,
        Buffer.from("%PDF-1.4\nNew revision\n%%EOF"),
        "third.pdf",
        fixtureId,
      )
    ).statusCode,
    200,
  );
  const third = await detail(app, customer, fixtureId);
  assert.equal(third.requirements.find((item) => item.id === changed.id)?.state, "submitted");
  assert.deepEqual(
    third.revisions
      .filter((item) => item.requirementId === changed.id)
      .map((item) => item.number)
      .sort(),
    [1, 2, 3],
  );
  assert.equal(third.reviews.length, 2);
});

test("simultaneous reviewers get one decision and one explicit conflict", async () => {
  const fixtureId = "review-concurrent";
  await fixtureOnboarding(db, fixtureId);
  const endpoint = `/api/onboardings/${fixtureId}/requirements/${fixtureId}-agreement/reviews`;
  assert.equal(
    (
      await upload(
        app,
        await login(app, "maya"),
        `${fixtureId}-agreement`,
        0,
        Buffer.from("%PDF-1.4\nConcurrent\n%%EOF"),
        "agreement.pdf",
        fixtureId,
      )
    ).statusCode,
    200,
  );
  const reviewer = await login(app, "noah");
  const requirement = (await detail(app, reviewer, fixtureId)).requirements.find(
    (item) => item.kind === "agreement",
  );
  assert.ok(requirement?.currentRevisionId);
  const decide = () =>
    app.inject({
      method: "POST",
      url: endpoint,
      headers: { cookie: reviewer },
      payload: {
        revisionId: requirement.currentRevisionId,
        version: requirement.version,
        decision: "approved",
        reason: "",
      },
    });
  const outcomes = await Promise.all([decide(), decide()]);
  assert.deepEqual(outcomes.map((item) => item.statusCode).sort(), [200, 409]);
  const final = await detail(app, reviewer, fixtureId);
  assert.equal(
    final.reviews.filter((item) => item.revisionId === requirement.currentRevisionId).length,
    1,
  );
});
