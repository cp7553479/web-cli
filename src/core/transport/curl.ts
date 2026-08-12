import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { AppError } from "../errors";
import type { Logger } from "../logger/logger";
import {
  logRequest,
  maskHeaders,
  type Transport,
  type TransportFormField,
  type TransportRequest,
  type TransportResult,
} from "./transport";

export interface CurlTransportOptions {
  /** Defaults to system `curl`. Override for tests. */
  binary?: string;
  logger?: Logger;
}

/**
 * Executes HTTP requests by spawning the system `curl`. Uses temp files for
 * headers/body/json so we can move large payloads without Node string limits
 * and keep them out of process stdout/stderr.
 */
export class CurlTransport implements Transport {
  private readonly binary: string;
  private readonly logger?: Logger;

  constructor(options: CurlTransportOptions = {}) {
    this.binary = options.binary ?? "curl";
    this.logger = options.logger;
  }

  async execute(request: TransportRequest): Promise<TransportResult> {
    if (request.json !== undefined && request.form !== undefined) {
      throw new AppError("TransportRequest cannot include both json and form.", "TRANSPORT_AMBIGUOUS_BODY");
    }

    logRequest(this.logger, request);

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "web-cli-curl-"));
    const headersFile = path.join(tempDir, "headers.txt");
    const bodyFile = path.join(tempDir, "body.txt");
    const jsonFile = path.join(tempDir, "payload.json");

    try {
      // NOTE: intentionally NOT using --fail-with-body. We want curl to exit 0
      // for any HTTP response (including 4xx/5xx) so the provider's parseResponse
      // can inspect statusCode + body and throw a classified ProviderError
      // (401→retryable-credential, 429→retryable-transport, …). curl only exits
      // non-zero here for genuine transport failures (DNS/timeout/connection).
      const args: string[] = [
        this.binary,
        "--silent",
        "--show-error",
        "--location",
        "--request",
        request.method.toUpperCase(),
        "--dump-header",
        headersFile,
        "--url",
        request.url,
      ];

      if (request.timeoutMs && request.timeoutMs > 0) {
        args.push("--max-time", String(Math.max(1, Math.ceil(request.timeoutMs / 1000))));
      }

      for (const [name, value] of Object.entries(request.headers ?? {})) {
        args.push("--header", `${name}: ${value}`);
      }

      if (request.json !== undefined) {
        await writeFile(jsonFile, JSON.stringify(request.json), "utf8");
        args.push("--header", "Content-Type: application/json", "--data-binary", `@${jsonFile}`);
      }

      for (const field of request.form ?? []) {
        args.push("--form", formatFormField(field));
      }

      args.push("--output", bodyFile);

      const { stderrText } = await spawnCurl(args);

      const bodyText = await readFile(bodyFile, "utf8").catch(() => "");
      const headersText = await readFile(headersFile, "utf8").catch(() => "");
      const headers = parseHeaders(headersText);
      const statusCode = parseStatusCode(headersText);

      const result: TransportResult = { statusCode, headers, bodyText };
      this.logger?.log("http.response", {
        url: request.url,
        statusCode,
        bodyLength: bodyText.length,
      });

      return result;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function formatFormField(field: TransportFormField): string {
  if ("value" in field) {
    return `${field.name}=${field.value}`;
  }
  let formatted = `${field.name}=@${field.filePath}`;
  if (field.filename) formatted += `;filename=${field.filename}`;
  if (field.contentType) formatted += `;type=${field.contentType}`;
  return formatted;
}

interface SpawnResult {
  stdoutText: string;
  stderrText: string;
}

function spawnCurl(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdoutChunks).toString("utf8");
      const stderrText = Buffer.concat(stderrChunks).toString("utf8");
      // --fail-with-body makes curl exit 22 on 4xx/5xx but still wrote the body.
      if (code !== 0) {
        reject(
          new AppError(
            `curl failed (exit ${code ?? -1})${stderrText ? `: ${stderrText.trim()}` : ""}`,
            "TRANSPORT_CURL_FAILED",
            { stdout: stdoutText.slice(0, 500), stderr: stderrText.slice(0, 500) },
          ),
        );
        return;
      }
      resolve({ stdoutText, stderrText });
    });
  });
}

/**
 * Parses the last header block emitted by `--dump-header` (curl emits one block
 * per hop with `--location`). Returns lower-cased header names.
 */
function parseHeaders(rawHeaders: string): Record<string, string> {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const lastBlock = blocks.at(-1) ?? "";
  const lines = lastBlock.split(/\r?\n/).slice(1);

  return lines.reduce<Record<string, string>>((acc, line) => {
    const separator = line.indexOf(":");
    if (separator <= 0) return acc;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function parseStatusCode(rawHeaders: string): number {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const statusLine = blocks.at(-1)?.split(/\r?\n/)[0] ?? "";
  const match = statusLine.match(/^HTTP\/\S+\s+(\d{3})/);
  return match ? Number(match[1]) : 0;
}

export { maskHeaders };
