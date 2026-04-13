import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function distEntry(): string {
  return path.join(process.cwd(), "dist", "index.js");
}

export function assertDistBuilt(): void {
  if (!fs.existsSync(distEntry())) {
    throw new Error("dist/index.js missing: run npm run build before integration tests");
  }
}

export function runWeb(
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string } = {},
): { status: number; stdout: string; stderr: string } {
  assertDistBuilt();
  const node = process.execPath;
  const env = { ...process.env, ...options.env };
  try {
    const stdout = execFileSync(node, [distEntry(), ...args], {
      encoding: "utf8",
      cwd: options.cwd ?? process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout: String(stdout), stderr: "" };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      status: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout !== undefined ? String(err.stdout) : "",
      stderr: err.stderr !== undefined ? String(err.stderr) : "",
    };
  }
}
