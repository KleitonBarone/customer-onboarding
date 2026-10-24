import { requireRunContext } from "../../../scripts/run-context.js";
import { createApp } from "./app.js";
import { connectDatabase } from "./database.js";

const { url, storageRoot } = await requireRunContext();
const { db, client } = connectDatabase(url);
const app = await createApp(db, {
  demo: true,
  logger: true,
  reminders: true,
  storageRoot,
});
app.addHook("onClose", async () => client.end());
await app.listen({ host: "127.0.0.1", port: Number(process.env.API_PORT ?? 4311) });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}
