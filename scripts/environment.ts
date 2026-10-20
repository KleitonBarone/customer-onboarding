import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { type } from "arktype";

const root = fileURLToPath(new URL("..", import.meta.url));
const runs = path.join(root, ".local", "runs");
const reports = path.join(root, ".local", "reports");
const windows = process.platform === "win32";
const workspace = windows
  ? root
      .replace(/^([A-Za-z]):/, (_, drive: string) => `/mnt/${drive.toLowerCase()}`)
      .replaceAll("\\", "/")
  : root;
const manifestSchema = type({
  id: "string",
  project: "string",
  status: "'running' | 'cleaned' | 'cleanup_failed'",
  createdAt: "string",
  owner: "number",
  "ownerIdentity?": "string",
  "mode?": "'dev' | 'verify'",
  "subnet?": "string",
  processes: type({ pid: "number", identity: "string", "keepAlive?": "boolean" }).array(),
  ports: { ui: "number", api: "number", db: "number" },
});
type Manifest = typeof manifestSchema.infer;

function command(binary: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const child = spawn(binary, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = new Promise<string>((resolve, reject) => {
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-100_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-100_000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${binary} ${args[0]} exited ${code}\n${output}`)),
    );
  });
  return { child, result };
}

function docker(args: string[], dbPort?: number, subnet?: string) {
  return windows
    ? command("wsl.exe", [
        "-d",
        "Ubuntu",
        "--cd",
        workspace,
        "--exec",
        "env",
        ...(dbPort ? [`DB_PORT=${dbPort}`] : []),
        ...(subnet ? [`COMPOSE_SUBNET=${subnet}`] : []),
        "docker",
        ...args,
      ]).result
    : command("docker", args, {
        ...process.env,
        ...(dbPort ? { DB_PORT: String(dbPort) } : {}),
        ...(subnet ? { COMPOSE_SUBNET: subnet } : {}),
      }).result;
}

function compose(manifest: Manifest, args: string[]) {
  return docker(
    ["compose", "-f", "compose.yaml", "-p", manifest.project, ...args],
    manifest.ports.db,
    manifest.subnet,
  );
}

async function availableSubnet() {
  const ids = (await docker(["network", "ls", "-q"])).trim().split(/\s+/).filter(Boolean);
  const existing = ids.length
    ? await docker([
        "network",
        "inspect",
        ...ids,
        "--format",
        "{{range .IPAM.Config}}{{.Subnet}} {{end}}",
      ])
    : "";
  const numeric = (address: string) =>
    address.split(".").reduce((value, byte) => value * 256 + Number(byte), 0);
  const ranges = existing
    .trim()
    .split(/\s+/)
    .filter((cidr) => /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(cidr))
    .map((cidr) => {
      const [address = "", prefix = "32"] = cidr.split("/");
      const start = numeric(address);
      return { start, end: start + 2 ** (32 - Number(prefix)) - 1 };
    });
  for (let block = 240; block < 255; block++) {
    const address = `10.232.${block}.0`;
    const start = numeric(address);
    if (!ranges.some((range) => start <= range.end && start + 255 >= range.start))
      return `${address}/24`;
  }
  throw new Error(
    "No unused project subnet found. Inspect Docker networks without pruning shared resources.",
  );
}

async function freePort(preferred = 0) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferred, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Cannot allocate a local port");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function identity(pid: number) {
  try {
    const output = windows
      ? await command("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')`,
        ]).result
      : await command("ps", ["-p", String(pid), "-o", "lstart="]).result;
    return output.trim();
  } catch {
    return null;
  }
}

function directoryFor(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid run identity");
  return path.join(runs, id);
}

async function save(manifest: Manifest) {
  await writeFile(
    path.join(directoryFor(manifest.id), "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function ownedRunDirectory(id: string) {
  const base = await realpath(runs);
  const target = await realpath(directoryFor(id));
  const repository = await realpath(root);
  if (!base.startsWith(`${repository}${path.sep}`) || !target.startsWith(`${base}${path.sep}`))
    throw new Error("Cleanup target escapes the task workspace");
  return target;
}

async function manifests() {
  await mkdir(runs, { recursive: true });
  const found: Manifest[] = [];
  for (const entry of await readdir(runs, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const result = manifestSchema(
      JSON.parse(await readFile(path.join(directoryFor(entry.name), "manifest.json"), "utf8")),
    );
    if (
      result instanceof type.errors ||
      result.id !== entry.name ||
      result.project !== `codex-onboarding-${result.id}`
    )
      throw new Error(`Refusing invalid run manifest ${entry.name}`);
    found.push(result);
  }
  return found;
}

async function cleanup(manifest: Manifest) {
  const stop = async (child: Manifest["processes"][number]) => {
    if ((await identity(child.pid)) !== child.identity) return;
    if (windows)
      await command("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]).result.catch(
        async (error: unknown) => {
          if (await identity(child.pid)) throw error;
        },
      );
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* A child may have exited after its identity check. */
      }
    }
  };
  for (const child of manifest.processes.toReversed().filter((item) => !item.keepAlive))
    await stop(child);
  await compose(manifest, ["down", "--volumes", "--remove-orphans", "--timeout", "5"]);
  const remaining = await docker([
    "ps",
    "-aq",
    "--filter",
    `label=com.docker.compose.project=${manifest.project}`,
  ]);
  if (remaining.trim()) throw new Error(`Containers remain for ${manifest.project}`);
  for (const child of manifest.processes.filter((item) => item.keepAlive)) await stop(child);
  for (const child of manifest.processes) {
    if ((await identity(child.pid)) === child.identity)
      throw new Error(`Owned process ${child.pid} is still running`);
  }
  const target = await ownedRunDirectory(manifest.id);
  await rm(path.join(target, "uploads"), { recursive: true, force: true });
  manifest.status = "cleaned";
  await save(manifest);
}

async function ready(url: string, stopped: () => boolean) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && !stopped()) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {
      /* Wait only within the readiness deadline. */
    }
    await delay(200);
  }
  throw new Error(`Service did not become ready: ${url}`);
}

function pnpmCommand(args: string[]) {
  const entry = process.env.npm_execpath;
  if (!entry) throw new Error("Use the documented pnpm command to run the environment");
  return entry.endsWith(".exe")
    ? { binary: entry, args }
    : { binary: process.execPath, args: [entry, ...args] };
}

async function doctor() {
  console.log(`Node ${process.versions.node}; ${windows ? "WSL Ubuntu" : "native"} Docker`);
  console.log((await docker(["version", "--format", "{{.Server.Version}}"])).trim());
  console.log((await docker(["compose", "version", "--short"])).trim());
  console.log("Existing project resources:");
  console.log(
    (
      await docker([
        "ps",
        "-a",
        "--filter",
        "name=codex-onboarding-",
        "--format",
        "{{.Names}} {{.Status}}",
      ])
    ).trim() || "none",
  );
  for (const port of [4310, 4311, 55431]) {
    try {
      await freePort(port);
      console.log(`Port ${port}: available`);
    } catch {
      console.log(`Port ${port}: in use; verification will choose another port`);
    }
  }
}

async function run(mode: "dev" | "verify") {
  const id = `${Date.now().toString(36)}-${process.pid}`;
  const directory = directoryFor(id);
  const manifest: Manifest = {
    id,
    project: `codex-onboarding-${id}`,
    status: "running",
    createdAt: new Date().toISOString(),
    owner: process.pid,
    ownerIdentity: (await identity(process.pid)) ?? "",
    mode,
    subnet: await availableSubnet(),
    processes: [],
    ports: {
      ui: await freePort(mode === "dev" ? Number(process.env.UI_PORT ?? 4310) : 0),
      api: await freePort(mode === "dev" ? Number(process.env.API_PORT ?? 4311) : 0),
      db: await freePort(mode === "dev" ? Number(process.env.DB_PORT ?? 55431) : 0),
    },
  };
  await mkdir(directory, { recursive: true });
  await save(manifest);
  const environment = {
    ...process.env,
    APP_ENV: "demo",
    DATABASE_URL: `postgres://onboarding:local-disposable-only@127.0.0.1:${manifest.ports.db}/customer_onboarding_demo`,
    API_PORT: String(manifest.ports.api),
    UI_PORT: String(manifest.ports.ui),
    STORAGE_ROOT: path.join(directory, "uploads"),
    BASE_URL: `http://127.0.0.1:${manifest.ports.ui}`,
    DEMO_RUN_ID: id,
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, ".local", "browsers"),
  };
  let interrupted = false;
  let failed = false;
  const signal = () => {
    interrupted = true;
  };
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  const logPath = path.join(directory, "services.log");
  await writeFile(logPath, "");
  let logBytes = 0;
  const logLimit = 5 * 1024 * 1024;
  const log = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      void (async () => {
        if (logBytes + chunk.length > logLimit) {
          await rm(`${logPath}.1`, { force: true });
          await rename(logPath, `${logPath}.1`);
          logBytes = 0;
        }
        const bounded = chunk.subarray(-logLimit);
        await appendFile(logPath, bounded);
        logBytes += bounded.length;
      })().then(
        () => callback(),
        (error: Error) => callback(error),
      );
    },
  });
  const active: ReturnType<typeof spawn>[] = [];
  const start = async (args: string[], binary = process.execPath, keepAlive = false) => {
    const child = spawn(binary, args, {
      cwd: root,
      env: environment,
      detached: !windows,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    active.push(child);
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    child.on("error", (error) => log.write(`${error.message}\n`));
    if (!child.pid) throw new Error("Child process did not start");
    const started = await identity(child.pid);
    if (started) manifest.processes.push({ pid: child.pid, identity: started, keepAlive });
    await save(manifest);
    return child;
  };
  const invoke = async (args: string[]) => {
    console.log(`> pnpm ${args.join(" ")}`);
    const invocation = pnpmCommand(args);
    const child = await start(invocation.args, invocation.binary);
    const result = await new Promise<number | null>((resolve) => {
      if (child.exitCode !== null) return resolve(child.exitCode);
      child.once("exit", resolve);
    });
    if (result !== 0)
      throw new Error(
        `pnpm ${args.join(" ")} failed with ${result}. See ${directory}/services.log`,
      );
  };
  console.log(`Run ${id}: ${manifest.project}; database port ${manifest.ports.db}`);
  try {
    if (windows) await start(["-d", "Ubuntu", "--exec", "sleep", "infinity"], "wsl.exe", true);
    if (process.env.VERIFY_FAIL_AT === "before-database")
      throw new Error("Controlled startup failure");
    console.log((await compose(manifest, ["up", "-d", "--wait", "--wait-timeout", "60"])).trim());
    if (interrupted) return;
    await invoke(["exec", "tsx", "apps/api/src/prepare.ts"]);
    if (process.env.VERIFY_FAIL_AT === "after-database") throw new Error("Controlled test failure");
    if (mode === "verify") await invoke(["check"]);
    const apiProcess = await start(
      mode === "verify"
        ? ["apps/api/dist/apps/api/src/server.js"]
        : ["--import", "tsx", "apps/api/src/server.ts"],
    );
    await ready(
      `http://127.0.0.1:${manifest.ports.api}/api/health`,
      () => interrupted || apiProcess.exitCode !== null,
    );
    const webRequire = createRequire(path.join(root, "apps", "web", "package.json"));
    const vite = path.join(path.dirname(webRequire.resolve("vite/package.json")), "bin", "vite.js");
    await start([
      vite,
      ...(mode === "verify" ? ["preview"] : []),
      "apps/web",
      "--host",
      "127.0.0.1",
      "--port",
      String(manifest.ports.ui),
    ]);
    await ready(environment.BASE_URL, () => interrupted);
    console.log(
      `READY web=${environment.BASE_URL} api=http://127.0.0.1:${manifest.ports.api}; manifest=${path.join(directory, "manifest.json")}`,
    );
    if (mode === "verify") {
      const response = await fetch(`${environment.BASE_URL}/api/health`);
      if (!response.ok) throw new Error("Built web/API proxy check failed");
      const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      };
      if (pkg.scripts["test:e2e"]) await invoke(["test:e2e"]);
    } else {
      while (!interrupted && !existsSync(path.join(directory, "stop"))) {
        if (active.some((child) => child.exitCode !== null && child.exitCode !== 0))
          throw new Error("A development service exited; inspect the run log");
        await delay(250);
      }
    }
  } catch (error) {
    failed = true;
    await mkdir(reports, { recursive: true });
    await writeFile(path.join(reports, "failure.txt"), `${String(error)}\nRun ${id}\n`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await compose(manifest, ["logs", "--no-color", "--tail", "150"]).then((output) =>
        log.write(output),
      );
    } catch {
      /* Startup may fail before a container exists. */
    }
    try {
      await cleanup(manifest);
      console.log(`CLEANED ${manifest.project}`);
    } catch (error) {
      manifest.status = "cleanup_failed";
      await save(manifest);
      console.error(error);
      process.exitCode = 1;
    }
    await new Promise<void>((resolve) => log.end(resolve));
    if (failed)
      await writeFile(
        path.join(reports, "services.log"),
        await readFile(path.join(directory, "services.log")),
      );
    else {
      await rm(logPath, { force: true });
      await rm(`${logPath}.1`, { force: true });
    }
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
    if (interrupted) process.exitCode = 130;
    // Keep compact ownership records for recovery; drop older cleaned run directories.
    const history = (await manifests())
      .filter((item) => item.status === "cleaned" && item.id !== id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const old of history.slice(1))
      await rm(await ownedRunDirectory(old.id), { recursive: true, force: true });
  }
}

const mode = process.argv[2];
if (mode === "doctor") await doctor();
else if (mode === "status") {
  for (const manifest of await manifests())
    console.log(
      `${manifest.id}: ${manifest.status}; project=${manifest.project}; ports=${JSON.stringify(manifest.ports)}`,
    );
  console.log(
    (
      await docker([
        "ps",
        "-a",
        "--filter",
        "name=codex-onboarding-",
        "--format",
        "{{.Names}} {{.Status}}",
      ])
    ).trim() || "No project containers remain",
  );
} else if (mode === "clean") {
  for (const manifest of await manifests()) {
    if (manifest.status === "cleaned") continue;
    const owner = await identity(manifest.owner);
    if (owner) {
      if (owner !== manifest.ownerIdentity || manifest.mode !== "dev")
        throw new Error(`Run ${manifest.id} still has a live owner. Stop that run first.`);
      await writeFile(
        path.join(await ownedRunDirectory(manifest.id), "stop"),
        "Requested shutdown\n",
      );
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const current = manifestSchema.assert(
          JSON.parse(await readFile(path.join(directoryFor(manifest.id), "manifest.json"), "utf8")),
        );
        if (current.status === "cleaned") break;
        await delay(250);
      }
      const current = manifestSchema.assert(
        JSON.parse(await readFile(path.join(directoryFor(manifest.id), "manifest.json"), "utf8")),
      );
      if (current.status !== "cleaned")
        throw new Error(`Run ${manifest.id} has not finished shutdown; inspect env:status.`);
      continue;
    }
    await cleanup(manifest);
  }
} else if (mode === "dev" || mode === "verify") await run(mode);
else throw new Error("Expected doctor, dev, verify, status, or clean");
