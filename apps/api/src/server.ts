import Fastify from "fastify";
import { connectDatabase } from "./database.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required. Use pnpm dev or pnpm verify.");
const { db, client } = connectDatabase(url);
const app = Fastify({ logger: true });
app.get("/api/health", async () => {
  await db.execute("select 1");
  return { status: "ready" };
});
app.addHook("onClose", async () => client.end());
await app.listen({ host: "127.0.0.1", port: Number(process.env.API_PORT ?? 4311) });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}
