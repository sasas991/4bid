import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const backendDir = resolve(process.cwd(), "../backend");
const scriptPath = resolve(backendDir, "export_openapi.py");

if (!existsSync(scriptPath)) {
  console.error(`OpenAPI export script not found: ${scriptPath}`);
  process.exit(1);
}

const candidates =
  process.platform === "win32"
    ? [
        { cmd: "py", args: ["-3", scriptPath] },
        { cmd: "python", args: [scriptPath] },
      ]
    : [
        { cmd: "python3", args: [scriptPath] },
        { cmd: "python", args: [scriptPath] },
      ];

let lastError = null;

for (const candidate of candidates) {
  const result = spawnSync(candidate.cmd, candidate.args, {
    cwd: backendDir,
    stdio: "inherit",
  });

  if (result.error) {
    lastError = result.error;
    continue;
  }

  if (result.status === 0) {
    process.exit(0);
  }
}

if (lastError) {
  console.error(`Failed to execute Python interpreter: ${lastError.message}`);
} else {
  console.error("OpenAPI export failed: no Python interpreter succeeded.");
}

process.exit(1);
