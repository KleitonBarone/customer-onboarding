import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

// A separate process exercises the API's real startup processor against the
// verification database. Exit closes its timer and connection before a restart.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Run this helper through pnpm verify");
const { db, client } = connectDatabase(url);
const app = await createApp(db, { demo: true, reminders: true });
try {
  await app.ready();
} finally {
  await app.close();
  await client.end();
}
