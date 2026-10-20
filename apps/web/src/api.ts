import {
  actorSchema,
  detailSchema,
  onboardingsSchema,
  personasSchema,
  type queueInput,
} from "../../../packages/contracts/src/index.js";

export async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
        ? data.message
        : "The request failed. Try again.",
    );
  return data;
}

export const api = {
  personas: async (signal?: AbortSignal) =>
    personasSchema.assert(await request("/demo/personas", { signal })),
  session: async (signal?: AbortSignal) => {
    const response = await fetch("/api/session", { signal });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Cannot load your session. Reload to try again.");
    return actorSchema.assert(await response.json());
  },
  onboardings: async (query: typeof queueInput.infer, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    return onboardingsSchema.assert(await request(`/onboardings?${params}`, { signal }));
  },
  detail: async (id: string, signal?: AbortSignal) =>
    detailSchema.assert(await request(`/onboardings/${encodeURIComponent(id)}`, { signal })),
};
