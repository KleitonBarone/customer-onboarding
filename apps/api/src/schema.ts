import { boolean, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const demoIdentity = pgTable("demo_identity", {
  id: text("id").primaryKey(),
});

export const role = pgEnum("role", ["manager", "reviewer", "customer"]);
export const requirementState = pgEnum("requirement_state", [
  "missing",
  "submitted",
  "changes_requested",
  "approved",
]);
export const requirementKind = pgEnum("requirement_kind", [
  "company",
  "agreement",
  "import",
  "contact",
]);
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});
export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    role: role("role").notNull(),
  },
  (table) => [unique().on(table.userId, table.workspaceId)],
);
export const customerAccounts = pgTable("customer_accounts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
});
export const customerMemberships = pgTable(
  "customer_memberships",
  {
    id: text("id").primaryKey(),
    membershipId: text("membership_id")
      .notNull()
      .references(() => memberships.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerAccounts.id),
  },
  (table) => [unique().on(table.membershipId, table.customerId)],
);
export const onboardings = pgTable("onboardings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customerAccounts.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  activeAt: timestamp("active_at", { withTimezone: true, mode: "string" }),
  version: integer("version").notNull().default(0),
});
export const requirements = pgTable(
  "requirements",
  {
    id: text("id").primaryKey(),
    onboardingId: text("onboarding_id")
      .notNull()
      .references(() => onboardings.id),
    kind: requirementKind("kind").notNull(),
    title: text("title").notNull(),
    mandatory: boolean("mandatory").notNull().default(true),
    state: requirementState("state").notNull().default("missing"),
    currentRevisionId: text("current_revision_id"),
    version: integer("version").notNull().default(0),
  },
  (table) => [unique().on(table.onboardingId, table.kind)],
);
export const revisions = pgTable("revisions", {
  id: text("id").primaryKey(),
  requirementId: text("requirement_id")
    .notNull()
    .references(() => requirements.id),
  content: text("content").notNull(),
  number: integer("number").notNull().default(1),
  storageId: text("storage_id"),
  fileName: text("file_name"),
  mediaType: text("media_type"),
  size: integer("size"),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  onboardingId: text("onboarding_id")
    .notNull()
    .references(() => onboardings.id),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  membershipId: text("membership_id")
    .notNull()
    .references(() => memberships.id),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
});
