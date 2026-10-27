import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const backendDir = path.join(repoRoot, "backend");
const port = process.env.E2E_PORT ?? "8000";

function runs(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function findPython() {
  const candidates = [
    process.env.PYTHON,
    path.join(backendDir, ".venv", "Scripts", "python.exe"),
    path.join(backendDir, ".venv", "bin", "python"),
    "python",
    "python3",
  ].filter(Boolean);

  return candidates.find(runs) ?? "python";
}

const python = findPython();
const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port],
  {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      WORKSPACE_ROOT:
        process.env.WORKSPACE_ROOT ?? path.join(frontendDir, "e2e", ".generated", "workspaces"),
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Failed to start the backend with ${python}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

const signals =
  process.platform === "win32"
    ? ["SIGINT", "SIGTERM", "SIGBREAK"]
    : ["SIGINT", "SIGTERM"];

for (const signal of signals) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
