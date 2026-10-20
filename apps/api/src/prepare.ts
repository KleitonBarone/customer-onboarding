import { connectDatabase, migrateDatabase } from "./database.js";
import { seedDatabase } from "./seed.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const { db, client } = connectDatabase(url);
try {
  await migrateDatabase(db);
  await seedDatabase(db, process.env.STORAGE_ROOT);
} finally {
  await client.end();
}
