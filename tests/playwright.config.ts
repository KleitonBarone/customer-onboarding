import path from "node:path";
import { defineConfig } from "@playwright/test";

if (!process.env.BASE_URL) throw new Error("Use pnpm verify for disposable browser services.");
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".local/browsers");

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 120_000,
  outputDir: path.resolve(".local/reports/browser"),
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
