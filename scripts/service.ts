import type { ChildProcess } from "node:child_process";

// Setup commands may finish successfully; a long-lived service must stay alive
// until the runner starts shutdown. Resolve errors so an early exit is retained.
export function serviceExit(child: ChildProcess, name: string, expectedExit = () => false) {
  return new Promise<Error>((resolve) => {
    child.once("error", (error) => resolve(new Error(`${name} failed to start: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (!expectedExit())
        resolve(new Error(`${name} exited unexpectedly (${signal ?? `code ${code}`}).`));
    });
  });
}
