import assert from "node:assert/strict";
import { detailSchema } from "../../../packages/contracts/src/index.js";
import type { createApp } from "../src/app.js";

export type TestApp = Awaited<ReturnType<typeof createApp>>;

export async function login(app: TestApp, membershipId: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/demo/session",
    payload: { membershipId },
  });
  assert.equal(response.statusCode, 200, response.body);
  const cookie = response.cookies.find((item) => item.name === "relay_session");
  assert.ok(cookie);
  return `relay_session=${cookie.value}`;
}

export async function detail(app: TestApp, cookie: string, id = "juniper") {
  const response = await app.inject({ url: `/api/onboardings/${id}`, headers: { cookie } });
  assert.equal(response.statusCode, 200, response.body);
  return detailSchema.assert(response.json());
}

export function upload(
  app: TestApp,
  cookie: string,
  requirementId: string,
  version: number,
  bytes: Buffer,
  filename = "agreement.pdf",
  onboardingId = "juniper",
) {
  const boundary = "onboarding-test-boundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: "POST",
    url: `/api/onboardings/${onboardingId}/requirements/${requirementId}/files?version=${version}`,
    headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
}
