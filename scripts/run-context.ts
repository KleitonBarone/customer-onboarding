import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type } from "arktype";

const execute = promisify(execFile);
export const manifestSchema = type({
  id: "string",
  project: "string",
  status: "'running' | 'cleaned' | 'cleanup_failed'",
  createdAt: "string",
  owner: "number.integer > 0",
  "ownerIdentity?": "string",
  "mode?": "'dev' | 'verify'",
  "subnet?": "string",
  "databaseContainerId?": "string",
  processes: type({ pid: "number", identity: "string", "keepAlive?": "boolean" }).array(),
  ports: { ui: "number", api: "number", db: "number" },
});
export type Manifest = typeof manifestSchema.infer;

export async function processIdentity(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const result =
      process.platform === "win32"
        ? await execute(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-Command",
              `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')`,
            ],
            { windowsHide: true },
          )
        : await execute("ps", ["-p", String(pid), "-o", "lstart="]);
    return result.stdout.trim();
  } catch {
    return null;
  }
}

export function databaseUrl(manifest: Pick<Manifest, "ports">) {
  return `postgres://onboarding:local-disposable-only@127.0.0.1:${manifest.ports.db}/customer_onboarding_demo`;
}

const containerSchema = type({
  Id: "string",
  State: { Running: "boolean" },
  Config: {
    Labels: { "com.docker.compose.project": "string", "com.docker.compose.service": "string" },
  },
  NetworkSettings: {
    Ports: { "5432/tcp": type({ HostIp: "string", HostPort: "string" }).array() },
  },
});

// Validate the recorded owner and published Docker container before any database
// connection. A demo flag or a caller-provided connection string is insufficient.
export async function requireRunContext(
  requiredMode?: "dev" | "verify",
  environment: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
) {
  const refuse = (reason: string) =>
    new Error(`Refusing database access: ${reason} Use pnpm dev or pnpm verify.`);
  const id = environment.DEMO_RUN_ID;
  if (environment.APP_ENV !== "demo" || !id || !/^[a-z0-9-]+$/.test(id))
    throw refuse("an explicit recorded demo run is required.");
  let manifest: Manifest;
  let directory: string;
  try {
    const repository = await realpath(root);
    const runs = await realpath(path.join(root, ".local", "runs"));
    directory = await realpath(path.join(runs, id));
    if (!runs.startsWith(repository + path.sep) || !directory.startsWith(runs + path.sep))
      throw new Error("Run path escapes repository");
    manifest = manifestSchema.assert(
      JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")),
    );
  } catch {
    throw refuse("the run record is missing or invalid.");
  }
  if (
    manifest.id !== id ||
    manifest.project !== `codex-onboarding-${id}` ||
    manifest.status !== "running" ||
    !manifest.mode
  )
    throw refuse("the run is not an active owned demo.");
  if (requiredMode && manifest.mode !== requiredMode)
    throw refuse(`this command requires a ${requiredMode} run.`);
  const url = databaseUrl(manifest);
  if (environment.DATABASE_URL !== url)
    throw refuse("DATABASE_URL does not match the recorded database URL.");
  if (!manifest.ownerIdentity || (await processIdentity(manifest.owner)) !== manifest.ownerIdentity)
    throw refuse("the recorded run owner is no longer alive.");
  if (!manifest.databaseContainerId || !/^[a-f0-9]{64}$/.test(manifest.databaseContainerId))
    throw refuse("the run has no recorded database container.");
  const args = ["container", "inspect", manifest.databaseContainerId, "--format", "{{json .}}"];
  let container: typeof containerSchema.infer;
  try {
    const result =
      process.platform === "win32"
        ? await execute("wsl.exe", ["-d", "Ubuntu", "--exec", "docker", ...args], {
            windowsHide: true,
          })
        : await execute("docker", args);
    container = containerSchema.assert(JSON.parse(result.stdout));
  } catch {
    throw refuse("the recorded database container is unavailable.");
  }
  const ports = container.NetworkSettings.Ports["5432/tcp"];
  if (
    container.Id !== manifest.databaseContainerId ||
    !container.State.Running ||
    container.Config.Labels["com.docker.compose.project"] !== manifest.project ||
    container.Config.Labels["com.docker.compose.service"] !== "database" ||
    ports.length !== 1 ||
    ports[0]?.HostIp !== "127.0.0.1" ||
    ports[0]?.HostPort !== String(manifest.ports.db)
  )
    throw refuse("the database container does not match the recorded project and port.");
  return { url, storageRoot: path.join(directory, "uploads"), directory, mode: manifest.mode };
}
