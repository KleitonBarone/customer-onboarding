import { pgTable, text } from "drizzle-orm/pg-core";

export const demoIdentity = pgTable("demo_identity", {
  id: text("id").primaryKey(),
});
