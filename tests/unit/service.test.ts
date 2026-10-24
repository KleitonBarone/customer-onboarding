import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { serviceExit } from "../../scripts/service.js";

for (const code of [0, 1]) {
  test(`a service exit with code ${code} ends its run`, async () => {
    const child = spawn(process.execPath, ["-e", `process.exit(${code})`], {
      windowsHide: true,
      stdio: "ignore",
    });
    try {
      assert.match(
        (await serviceExit(child, "API")).message,
        new RegExp(`API exited unexpectedly \\(code ${code}\\)`),
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
  });
}

test("an intentional API reload does not fail the environment", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
    windowsHide: true,
    stdio: "ignore",
  });
  let failed = false;
  void serviceExit(child, "API", () => true).then(() => {
    failed = true;
  });
  await once(child, "exit");
  assert.equal(failed, false);
});
