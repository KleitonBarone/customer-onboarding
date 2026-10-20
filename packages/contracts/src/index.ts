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
export const onboardingsSchema = onboardingSchema.array();
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
export const detailSchema = type({
  onboarding: onboardingSchema,
  requirements: requirementSchema.array(),
  revisions: revisionSchema.array(),
  activity: activitySchema.array(),
});
export type OnboardingDetail = typeof detailSchema.infer;
export const sessionInput = type({ membershipId: "string > 0", "+": "reject" });
export const versionInput = type("number.integer >= 0");
export const submissionInput = type({
  content: "0 < string <= 5000",
  version: "number.integer >= 0",
  "+": "reject",
});
