import fs from "node:fs";
import path from "node:path";

/** Minimal logging surface used across core and domain. */
export interface Logger {
  log(label: string, payload: unknown): void;
}

/**
 * Append-only logger that writes timestamped entries to a daily file under
 * `<logsDir>/<YYYY-MM-DD>-<id>.log`. Designed for diagnostics only — never put
 * secrets in payloads (mask auth headers before logging).
 */
export class FileLogger implements Logger {
  readonly filePath: string;
  private readonly fd: number;

  constructor(logsDir: string) {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    fs.mkdirSync(logsDir, { recursive: true });
    this.filePath = path.join(logsDir, `${date}-${generateLogId()}.log`);
    this.fd = fs.openSync(this.filePath, "a");
  }

  log(label: string, payload: unknown): void {
    const ts = new Date().toISOString();
    const body = typeof payload === "string" ? payload : safeStringify(payload);
    fs.writeSync(this.fd, `[${ts}] ${label}\n${body}\n\n`);
  }
}

/**stderr writer for unrecoverable, non-user-facing internal errors. */
export function errorLog(label: string, error: unknown): void {
  const body = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`[ERROR] ${label}\n${body}\n`);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function generateLogId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
