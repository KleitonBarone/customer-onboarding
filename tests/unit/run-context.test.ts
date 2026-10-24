import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  databaseUrl,
  type Manifest,
  processIdentity,
  requireRunContext,
} from "../../scripts/run-context.js";

test("database ownership rejects a changed URL, wrong run mode, and stale owner", async () => {
  await mkdir(".local", { recursive: true });
  const root = await mkdtemp(path.resolve(".local", "run-context-test-"));
  const directory = path.join(root, ".local", "runs", "guard-test");
  const manifest: Manifest = {
    id: "guard-test",
    project: "codex-onboarding-guard-test",
    status: "running",
    mode: "verify",
    createdAt: new Date().toISOString(),
    owner: process.pid,
    ownerIdentity: (await processIdentity(process.pid)) ?? "",
    processes: [],
    ports: { ui: 4310, api: 4311, db: 55431 },
    databaseContainerId: "f".repeat(64),
  };
  const environment = {
    APP_ENV: "demo",
    DEMO_RUN_ID: manifest.id,
    DATABASE_URL: databaseUrl(manifest),
  };
  const save = () => writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  try {
    await mkdir(directory, { recursive: true });
    await save();
    await assert.rejects(
      requireRunContext(
        "verify",
        { ...environment, DATABASE_URL: "postgres://127.0.0.1/another" },
        root,
      ),
      /recorded database URL/,
    );
    manifest.mode = "dev";
    await save();
    await assert.rejects(requireRunContext("verify", environment, root), /requires a verify run/);
    manifest.mode = "verify";
    manifest.ownerIdentity = "a previous process";
    await save();
    await assert.rejects(
      requireRunContext("verify", environment, root),
      /owner is no longer alive/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
