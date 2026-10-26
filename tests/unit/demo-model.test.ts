import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore } from "../../apps/web/src/demo/model.js";
import { detailSchema, onboardingsSchema } from "../../packages/contracts/src/index.js";

const fixtures = { agreement: "data:application/pdf;base64,JVBERi0=", import: "data:text/csv,a,b" };
const pdf = new File(["%PDF-1.4\nSynthetic agreement\n%%EOF"], "agreement.pdf");
const company = {
  kind: "company",
  legalName: "Beacon Supply Ltd",
  registeredAddress: "42 Harbour Road",
  version: 0,
};

test("demo fixtures, owner filters and persona scope are isolated per store", () => {
  const store = createDemoStore(fixtures);
  const initial = onboardingsSchema.assert(store.onboardings({ limit: 20, offset: 0 }));
  assert.equal(initial.length, 5);
  assert.deepEqual(
    store
      .onboardings({ limit: 20, offset: 0, ownerId: "oliver" })
      .map((item) => item.id)
      .sort(),
    ["cedar", "lumen"],
  );
  store.login("owen");
  store.submitDetails("beacon", "beacon-company", company);
  assert.equal(store.detail("beacon").onboarding.status, "in_progress");
  assert.throws(() => store.detail("juniper"), /not found/);
  assert.throws(() => store.documentUrl("juniper-agreement-seed-1"), /not found/);
  const other = createDemoStore(fixtures);
  assert.equal(other.detail("beacon").onboarding.status, "draft");
  store.login("iris");
  assert.deepEqual(
    store.onboardings({ limit: 20, offset: 0 }).map((item) => item.id),
    ["westhaven"],
  );
  assert.throws(() => store.detail("beacon"), /not found/);
  store.reset();
  assert.equal(store.session().membershipId, "ada");
  assert.equal(store.detail("beacon").onboarding.status, "draft");
});

test("the demo preserves correction history, version conflicts and activation gates", async (t) => {
  const store = createDemoStore(fixtures);
  t.after(() => store.reset());
  store.login("owen");
  store.submitDetails("beacon", "beacon-company", company);
  store.submitDetails("beacon", "beacon-contact", {
    kind: "contact",
    name: "Owen Reed",
    email: "owen@beacon.test",
    version: 0,
  });
  await store.submitFile("beacon", "beacon-agreement", 0, pdf);
  await store.submitFile("beacon", "beacon-import", 0, new File(["id,name\n1,Demo"], "sample.csv"));
  const original = detailSchema.assert(store.detail("beacon"));
  store.login("ada");
  assert.throws(
    () => store.activation("beacon", "activate", { version: original.onboarding.version }),
    /every mandatory/,
  );
  store.login("noah");
  for (const item of original.requirements) {
    store.review("beacon", item.id, {
      revisionId: item.currentRevisionId,
      version: item.version,
      decision: item.kind === "agreement" ? "changes_requested" : "approved",
      reason: item.kind === "agreement" ? "Include the signed page." : "",
    });
  }
  store.login("owen");
  await assert.rejects(store.submitFile("beacon", "beacon-agreement", 1, pdf), /changed/);
  await store.submitFile("beacon", "beacon-agreement", 2, pdf);
  const corrected = store.detail("beacon").requirements.find((item) => item.kind === "agreement");
  assert.ok(corrected?.currentRevisionId);
  const fileUrl = store.documentUrl(corrected.currentRevisionId);
  assert.deepEqual(
    await fetch(fileUrl).then((response) => response.arrayBuffer()),
    await pdf.arrayBuffer(),
  );
  store.login("noah");
  store.review("beacon", corrected.id, {
    revisionId: corrected.currentRevisionId,
    version: corrected.version,
    decision: "approved",
    reason: "",
  });
  assert.throws(
    () =>
      store.review("beacon", corrected.id, {
        revisionId: corrected.currentRevisionId,
        version: corrected.version,
        decision: "approved",
        reason: "",
      }),
    /changed/,
  );
  store.login("ada");
  const ready = store.detail("beacon");
  assert.equal(ready.onboarding.status, "ready");
  store.activation("beacon", "activate", { version: ready.onboarding.version });
  store.login("owen");
  assert.throws(
    () => store.submitDetails("beacon", "beacon-company", { ...company, version: 2 }),
    /active/,
  );
  store.login("ada");
  const active = store.detail("beacon");
  store.activation("beacon", "reopen", {
    version: active.onboarding.version,
    reason: "Update details",
  });
  store.login("owen");
  store.submitDetails("beacon", "beacon-company", { ...company, version: 2 });
  const updated = store.detail("beacon");
  assert.equal(updated.onboarding.status, "in_progress");
  assert.equal(updated.revisions.filter((item) => item.requirementId === corrected.id).length, 2);
  assert.ok(updated.reviews.some((item) => item.reason === "Include the signed page."));
  store.reset();
  await assert.rejects(fetch(fileUrl));
});

test("invalid and racing demo uploads leave a single current revision", async (t) => {
  const store = createDemoStore(fixtures);
  t.after(() => store.reset());
  store.login("owen");
  const before = store.detail("beacon");
  for (const file of [
    new File(["not a PDF"], "bad.pdf"),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.pdf"),
  ]) {
    await assert.rejects(store.submitFile("beacon", "beacon-agreement", 0, file));
    assert.deepEqual(store.detail("beacon"), before);
  }
  await assert.rejects(
    store.submitFile("beacon", "beacon-import", 0, new File([new Uint8Array([255, 0])], "bad.csv")),
    /UTF-8/,
  );
  const outcomes = await Promise.allSettled([
    store.submitFile("beacon", "beacon-agreement", 0, pdf),
    store.submitFile("beacon", "beacon-agreement", 0, pdf),
  ]);
  assert.deepEqual(outcomes.map((item) => item.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(store.detail("beacon").revisions.length, 1);
});

test("demo reminders deduplicate by workspace day and customer visibility", () => {
  const store = createDemoStore(fixtures);
  const before = store.notifications();
  assert.equal(before.filter((item) => item.onboardingId === "juniper").length, 1);
  assert.deepEqual(store.notifications(), before);
  store.advanceClock();
  assert.equal(store.notifications().filter((item) => item.onboardingId === "juniper").length, 2);
  store.login("owen");
  assert.deepEqual(store.notifications(), []);
  assert.throws(() => store.advanceClock(), /account managers/);
  store.login("iris");
  assert.equal(store.clock().now, "2026-10-15T12:00:00.000Z");
  assert.deepEqual(store.notifications(), []);
});
