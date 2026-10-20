import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/api/src/schema.ts",
  out: "./apps/api/migrations",
});
