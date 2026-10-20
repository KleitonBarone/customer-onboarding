import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = process.env.npm_execpath;
if (!entry) throw new Error("Run pnpm browser:install");
const args = [
  "exec",
  "playwright",
  "install",
  "chromium",
  "--only-shell",
  ...(process.env.CI ? ["--with-deps"] : []),
];
const child = spawn(
  entry.endsWith(".exe") ? entry : process.execPath,
  entry.endsWith(".exe") ? args : [entry, ...args],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ??
        fileURLToPath(new URL("../.local/browsers", import.meta.url)),
    },
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
