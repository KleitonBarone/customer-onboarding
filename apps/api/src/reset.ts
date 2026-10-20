import { eq, sql } from "drizzle-orm";
import { ApiError } from "./access.js";
import type { Database } from "./database.js";
import { demoIdentity } from "./schema.js";

// Reset is a local operator command; no tenant-facing API can reset other tenants.
export async function assertDemoDatabase(
  db: Pick<Database, "execute" | "select">,
  explicitDemo: boolean,
) {
  if (!explicitDemo)
    throw new ApiError(403, "Reset requires an explicit recorded demo environment.");
  const [database] = await db.execute<{ name: string }>(sql`select current_database() as name`);
  if (database?.name !== "customer_onboarding_demo")
    throw new ApiError(
      403,
      "Refusing reset: database identity does not match this disposable demo.",
    );
  const [identity] = await db
    .select()
    .from(demoIdentity)
    .where(eq(demoIdentity.id, "customer-onboarding-disposable-v1"));
  if (!identity) throw new ApiError(403, "Refusing reset: the demo identity marker is missing.");
}
