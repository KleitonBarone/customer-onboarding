import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

export function connectDatabase(url: string) {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof connectDatabase>["db"];

export async function migrateDatabase(db: Database) {
  await migrate(db, { migrationsFolder: "apps/api/migrations" });
}
