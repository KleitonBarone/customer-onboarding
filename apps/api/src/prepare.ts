import { connectDatabase, migrateDatabase } from "./database.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const { db, client } = connectDatabase(url);
try {
  await migrateDatabase(db);
} finally {
  await client.end();
}
