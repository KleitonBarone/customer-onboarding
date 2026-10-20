import { type } from "arktype";

export const roleSchema = type("'manager' | 'reviewer' | 'customer'");
export const actorSchema = type({
  membershipId: "string",
  userId: "string",
  name: "string",
  workspaceId: "string",
  workspaceName: "string",
  role: roleSchema,
});
export type Actor = typeof actorSchema.infer;
export const personaSchema = type({
  id: "string",
  workspaceId: "string",
  name: "string",
  role: roleSchema,
  workspaceName: "string",
});
export const personasSchema = personaSchema.array();
export const requirementSchema = type({
  id: "string",
  kind: "'company' | 'agreement' | 'import' | 'contact'",
  title: "string",
  mandatory: "boolean",
  state: "'missing' | 'submitted' | 'changes_requested' | 'approved'",
  currentRevisionId: "string | null",
  version: "number",
});
export const onboardingSchema = type({
  id: "string",
  customerId: "string",
  company: "string",
  owner: "string",
  createdAt: "string",
  startedAt: "string | null",
  activeAt: "string | null",
  version: "number",
  status: "'draft' | 'in_progress' | 'ready' | 'active'",
});
export const queueInput = type({
  "status?": "'draft' | 'in_progress' | 'ready' | 'active'",
  "ownerId?": "string <= 100",
  "search?": "string <= 80",
  limit: "1 <= number.integer <= 50",
  offset: "0 <= number.integer <= 10000",
  "+": "reject",
});
export const onboardingsSchema = onboardingSchema
  .and({ ownerId: "string", ageDays: "number", nextAction: "string" })
  .array();
export const revisionSchema = type({
  id: "string",
  requirementId: "string",
  content: "string",
  number: "number",
  fileName: "string | null",
  mediaType: "string | null",
  size: "number | null",
  actor: "string",
  createdAt: "string",
});
export const activitySchema = type({
  id: "string",
  actor: "string",
  message: "string",
  createdAt: "string",
});
export const reviewSchema = type({
  id: "string",
  revisionId: "string",
  actor: "string",
  decision: "'approved' | 'changes_requested'",
  reason: "string",
  createdAt: "string",
});
export const reviewInput = type({
  revisionId: "string > 0",
  version: "number.integer >= 0",
  decision: "'approved' | 'changes_requested'",
  reason: "string <= 1000",
  "+": "reject",
});
export const detailSchema = type({
  onboarding: onboardingSchema,
  requirements: requirementSchema.array(),
  revisions: revisionSchema.array(),
  reviews: reviewSchema.array(),
  activity: activitySchema.array(),
});
export type OnboardingDetail = typeof detailSchema.infer;
export const sessionInput = type({ membershipId: "string > 0", "+": "reject" });
export const versionInput = type("number.integer >= 0");
export const activateInput = type({ version: "number.integer >= 0", "+": "reject" });
export const reopenInput = type({
  version: "number.integer >= 0",
  reason: "0 < string <= 1000",
  "+": "reject",
});
export const submissionInput = type({
  kind: "'company'",
  legalName: "0 < string <= 200",
  registeredAddress: "0 < string <= 500",
  version: "number.integer >= 0",
  "+": "reject",
}).or({
  kind: "'contact'",
  name: "0 < string <= 100",
  email: "string.email",
  version: "number.integer >= 0",
  "+": "reject",
});
