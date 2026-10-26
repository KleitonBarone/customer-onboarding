const additionalPersonas = [
  {
    id: "oliver",
    membershipId: "northstar-oliver",
    name: "Oliver Grant",
    email: "oliver@example.test",
    workspaceId: "northstar",
    role: "manager",
  },
  {
    id: "tessa",
    name: "Tessa Brooks",
    email: "tessa@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "eli",
    name: "Eli Morgan",
    email: "eli@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "jules",
    name: "Jules Bennett",
    email: "jules@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
] as const;

export const scenarioAccounts = [
  {
    id: "juniper",
    name: "Juniper Retail",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "maya",
    scenario: "changes_requested",
    createdAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "beacon",
    name: "Beacon Supply",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "owen",
    scenario: "missing",
    createdAt: "2026-10-14T09:00:00.000Z",
  },
  {
    id: "atlas",
    name: "Atlas Goods",
    workspaceId: "northstar",
    ownerId: "ada",
    member: "tessa",
    scenario: "submitted",
    createdAt: "2026-10-12T09:00:00.000Z",
  },
  {
    id: "cedar",
    name: "Cedar & Co",
    workspaceId: "northstar",
    ownerId: "oliver",
    member: "eli",
    scenario: "ready",
    createdAt: "2026-10-08T09:00:00.000Z",
  },
  {
    id: "lumen",
    name: "Lumen Home",
    workspaceId: "northstar",
    ownerId: "oliver",
    member: "jules",
    scenario: "active",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "westhaven",
    name: "Westhaven Stores",
    workspaceId: "elsewhere",
    ownerId: "iris",
    member: "leo",
    scenario: "missing",
    createdAt: "2026-10-13T09:00:00.000Z",
  },
] as const;

export const demoNow = "2026-10-15T12:00:00.000Z";
export const personaSeeds = [
  {
    id: "ada",
    name: "Ada Wells",
    email: "ada@example.test",
    workspaceId: "northstar",
    role: "manager",
  },
  {
    id: "noah",
    name: "Noah Ellis",
    email: "noah@example.test",
    workspaceId: "northstar",
    role: "reviewer",
  },
  {
    id: "maya",
    name: "Maya Chen",
    email: "maya@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "owen",
    name: "Owen Reed",
    email: "owen@example.test",
    workspaceId: "northstar",
    role: "customer",
  },
  {
    id: "iris",
    name: "Iris Park",
    email: "iris@example.test",
    workspaceId: "elsewhere",
    role: "manager",
  },
  {
    id: "leo",
    name: "Leo Silva",
    email: "leo@example.test",
    workspaceId: "elsewhere",
    role: "customer",
  },
  ...additionalPersonas,
] as const;

export const requirementSeeds = [
  { kind: "company", title: "Company details" },
  { kind: "agreement", title: "Service agreement" },
  { kind: "import", title: "Sample import file" },
  { kind: "contact", title: "Launch contact" },
] as const;

export const workspaceSeeds = [
  { id: "northstar", name: "Northstar Analytics" },
  { id: "elsewhere", name: "Elsewhere Metrics" },
] as const;
