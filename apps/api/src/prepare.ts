import { requireRunContext } from "../../../scripts/run-context.js";
import { connectDatabase, migrateDatabase } from "./database.js";
import { seedDatabase } from "./seed.js";

const { url, storageRoot } = await requireRunContext();
const { db, client } = connectDatabase(url);
try {
  await migrateDatabase(db);
  await seedDatabase(db, storageRoot);
} finally {
  await client.end();
}
