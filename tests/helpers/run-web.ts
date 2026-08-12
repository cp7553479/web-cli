import { spawn } from "node:child_process";
import path from "node:path";

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const ENTRY = path.resolve(__dirname, "..", "..", "dist", "index.js");

/**
 * Runs the built CLI (`dist/index.js`) as a subprocess with an isolated HOME,
 * so config tests never touch the developer's real ~/.web. Returns captured
 * stdout/stderr/exit-code. Caller passes extra env (e.g. API keys) as needed.
 */
export function runWeb(args: string[], env: Record<string, string> = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [ENTRY, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    child.stderr.on("data", (c) => errChunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(chunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
        code,
      });
    });
  });
}
