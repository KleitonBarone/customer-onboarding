import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { promisify } from "node:util";

for (const [name, args, forgedRun] of [
  ["preparation", ["apps/api/src/prepare.ts"], false],
  ["database tests", ["--test", "apps/api/test/health.test.ts"], true],
] as const) {
  test(`${name} refuse an unowned database before opening a connection`, async () => {
    let connections = 0;
    const server = createServer((socket) => {
      connections++;
      socket.destroy();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: `postgres://onboarding:local-disposable-only@127.0.0.1:${address.port}/customer_onboarding_demo`,
      };
      delete env.APP_ENV;
      delete env.DEMO_RUN_ID;
      delete env.NODE_TEST_CONTEXT;
      if (forgedRun) {
        env.APP_ENV = "demo";
        env.DEMO_RUN_ID = "not-a-recorded-run";
      }
      let output = "";
      try {
        const result = await promisify(execFile)(process.execPath, ["--import", "tsx", ...args], {
          env,
          timeout: 3_000,
          windowsHide: true,
        });
        output = result.stdout + result.stderr;
      } catch (error) {
        if (!(error instanceof Error) || !("stdout" in error) || !("stderr" in error)) throw error;
        output = String(error.stdout) + String(error.stderr);
      }
      assert.equal(connections, 0, "An unverified database must never receive a connection");
      assert.match(output, /Refusing database access/);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
