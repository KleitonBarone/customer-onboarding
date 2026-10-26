import sampleImport from "../../../../fixtures/sample-import.csv?url";
import agreement from "../../../../fixtures/service-agreement.pdf?url";
import { sessionInput } from "../../../../packages/contracts/src/index.js";
import type { api as backendApi } from "../api.js";
import { createDemoStore } from "./model.js";

const store = createDemoStore({ agreement, import: sampleImport });
export const isBrowserDemo = true;
export const documentUrl = store.documentUrl;

export const api = {
  clock: async () => store.clock(),
  notifications: async () => store.notifications(),
  personas: async () => store.personas(),
  session: async () => store.session(),
  onboardings: async (query: Parameters<typeof backendApi.onboardings>[0]) =>
    store.onboardings(query),
  detail: async (id: string) => store.detail(id),
} satisfies typeof backendApi;

// The existing UI sends mutation commands through this boundary. Demo commands
// call the tab's state directly and never issue an HTTP request.
export async function request(path: string, init?: RequestInit): Promise<unknown> {
  init?.signal?.throwIfAborted();
  if (init?.method !== "POST") throw new Error("Unsupported demo action.");
  const url = new URL(path, "https://demo.invalid");
  const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  if (url.pathname === "/demo/session") return store.login(sessionInput.assert(body).membershipId);
  if (url.pathname === "/demo/clock/advance") return store.advanceClock();
  const requirement =
    /^\/onboardings\/([^/]+)\/requirements\/([^/]+)\/(submissions|files|reviews)$/.exec(
      url.pathname,
    );
  if (requirement?.[1] && requirement[2]) {
    const id = decodeURIComponent(requirement[1]);
    const requirementId = decodeURIComponent(requirement[2]);
    if (requirement[3] === "submissions") return store.submitDetails(id, requirementId, body);
    if (requirement[3] === "reviews") return store.review(id, requirementId, body);
    return store.submitFile(
      id,
      requirementId,
      Number(url.searchParams.get("version")),
      init.body instanceof FormData ? init.body.get("file") : null,
    );
  }
  const activation = /^\/onboardings\/([^/]+)\/(activate|reopen)$/.exec(url.pathname);
  if (activation?.[1] && (activation[2] === "activate" || activation[2] === "reopen")) {
    return store.activation(decodeURIComponent(activation[1]), activation[2], body);
  }
  throw new Error("Demo action not found.");
}
