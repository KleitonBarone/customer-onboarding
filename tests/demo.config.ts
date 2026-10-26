import { createServer } from "node:net";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// Workers inherit the selected URL instead of allocating their own port.
if (!process.env.DEMO_TEST_URL) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Cannot allocate a demo test port");
  process.env.DEMO_TEST_URL = `http://127.0.0.1:${address.port}`;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
const baseURL = process.env.DEMO_TEST_URL;
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".local/browsers");

export default defineConfig({
  testDir: ".",
  testMatch: "demo.spec.ts",
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  globalTimeout: 120_000,
  outputDir: path.resolve(".local/reports/demo"),
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm preview:demo --port ${new URL(baseURL).port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
