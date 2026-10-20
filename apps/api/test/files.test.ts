import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";
import { seedDatabase } from "../src/seed.js";
import { detail, login, upload } from "./helpers.js";

const url = process.env.DATABASE_URL;
const storageRoot = process.env.STORAGE_ROOT;
if (!url || !storageRoot) throw new Error("Run tests through pnpm verify");
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
const pdf = Buffer.from("%PDF-1.4\nSynthetic service agreement\n%%EOF\n");

test("uploads enforce formats, size limits, customer role, and scoped identifiers", async () => {
  const cookie = await login(app, "maya");
  assert.equal(
    (
      await upload(
        app,
        cookie,
        "juniper-agreement",
        0,
        Buffer.from("<script>bad</script>"),
        "agreement.pdf",
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (await upload(app, cookie, "juniper-agreement", 0, Buffer.from("%PDF-").subarray(0, 2)))
      .statusCode,
    400,
  );
  assert.equal(
    (await upload(app, cookie, "juniper-agreement", 0, Buffer.alloc(2 * 1024 * 1024 + 1, 65)))
      .statusCode,
    413,
  );
  assert.equal(
    (await upload(app, await login(app, "ada"), "juniper-agreement", 0, pdf)).statusCode,
    403,
  );
  assert.equal(
    (await upload(app, await login(app, "owen"), "juniper-agreement", 0, pdf)).statusCode,
    404,
  );
  assert.equal((await upload(app, cookie, "beacon-agreement", 0, pdf)).statusCode, 404);
});

test("private downloads are authorized and failed replacements leave no orphan files", async () => {
  const cookie = await login(app, "maya");
  const response = await upload(app, cookie, "juniper-agreement", 0, pdf);
  assert.equal(response.statusCode, 200, response.body);
  const record = await detail(app, cookie);
  const revision = record.revisions.find((item) => item.fileName === "agreement.pdf");
  assert.ok(revision);
  assert.equal(revision.number, 1);
  const download = await app.inject({
    url: `/api/revisions/${revision.id}/file`,
    headers: { cookie },
  });
  assert.equal(download.statusCode, 200, download.body);
  assert.deepEqual(download.rawPayload, pdf);
  assert.match(String(download.headers["content-disposition"]), /^attachment;/);
  assert.equal(download.headers["x-content-type-options"], "nosniff");
  for (const persona of ["owen", "iris", "leo"])
    assert.equal(
      (
        await app.inject({
          url: `/api/revisions/${revision.id}/file`,
          headers: { cookie: await login(app, persona) },
        })
      ).statusCode,
      404,
    );
  assert.equal(
    (
      await app.inject({
        url: `/api/revisions/${revision.id}/file`,
        headers: { cookie: await login(app, "ada") },
      })
    ).statusCode,
    200,
  );
  const before = await readdir(storageRoot);
  assert.equal(
    (await upload(app, cookie, "juniper-agreement", 0, pdf, "replacement.pdf")).statusCode,
    409,
  );
  assert.deepEqual(await readdir(storageRoot), before);
});
