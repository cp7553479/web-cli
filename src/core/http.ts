import { request } from "undici";

import { AppError } from "./errors";
import type { FileLogger } from "./logger";

export interface HttpOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  fileLogger?: FileLogger;
}

export async function httpJson(url: string, options: HttpOptions): Promise<unknown> {
  const reqPayload = {
    url,
    method: options.method ?? "GET",
    headers: options.headers ?? {},
    body: options.body ?? null,
  };
  options.fileLogger?.log("http.request", reqPayload);

  const response = await request(url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    headersTimeout: options.timeoutMs,
    bodyTimeout: options.timeoutMs,
  });
  const text = await response.body.text();
  const resPayload = { url, statusCode: response.statusCode, body: text };
  options.fileLogger?.log("http.response", resPayload);

  if (response.statusCode >= 400) {
    throw new AppError(`HTTP ${response.statusCode}: ${url}`, "HTTP_STATUS_ERROR", text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

