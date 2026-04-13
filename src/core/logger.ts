import fs from "node:fs";
import path from "node:path";

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

export class FileLogger {
  readonly filePath: string;
  private fd: number;

  constructor(cwd: string) {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const logDir = path.join(cwd, ".web", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    this.filePath = path.join(logDir, `${date}-${generateLogId()}.log`);
    this.fd = fs.openSync(this.filePath, "a");
  }

  log(label: string, payload: unknown): void {
    const ts = new Date().toISOString();
    const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    fs.writeSync(this.fd, `[${ts}] ${label}\n${body}\n\n`);
  }

  close(): void {
    fs.closeSync(this.fd);
  }
}

