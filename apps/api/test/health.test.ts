import assert from "node:assert/strict";
import test from "node:test";
import { requireRunContext } from "../../../scripts/run-context.js";
import { connectDatabase, migrateDatabase } from "../src/database.js";

test("migrations run on real PostgreSQL", async () => {
  const { url } = await requireRunContext("verify");
  const { db, client } = connectDatabase(url);
  try {
    await migrateDatabase(db);
    assert.ok(await db.execute("select 1"));
  } finally {
    await client.end();
  }
});
