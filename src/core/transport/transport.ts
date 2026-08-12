import type { Logger } from "../logger/logger";

/** A multipart form field. Either an inline value or a file upload. */
export type TransportFormField =
  | { name: string; value: string }
  | {
      name: string;
      filePath: string;
      filename?: string;
      contentType?: string;
    };

/** A provider-built HTTP request handed to a {@link Transport}. */
export interface TransportRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** Multipart form body. Mutually exclusive with `json`. */
  form?: TransportFormField[];
  /** Per-request hard timeout in milliseconds (curl `--max-time`). */
  timeoutMs?: number;
}

/** The raw result of executing a {@link TransportRequest}. */
export interface TransportResult {
  statusCode: number;
  headers: Record<string, string>;
  bodyText: string;
}

/**
 * HTTP boundary. The default implementation is {@link CurlTransport}; providers
 * that need a browser (playwright) bypass this interface entirely.
 */
export interface Transport {
  execute(request: TransportRequest): Promise<TransportResult>;
}

/** Header names whose values must be masked before reaching any log. */
const SENSITIVE_HEADER_PREFIXES = ["authorization", "x-subscription-token", "x-api-key", "x-goog-api-key"];

/** Returns a copy of `headers` with sensitive values partially masked. */
export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = isSensitiveHeader(key) ? maskValue(value) : value;
  }
  return out;
}

function isSensitiveHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return SENSITIVE_HEADER_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix} `));
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 8)}****`;
}

/** Internal helper so CurlTransport can log requests through the same Logger. */
export function logRequest(logger: Logger | undefined, request: TransportRequest): void {
  if (!logger) return;
  logger.log("http.request", {
    method: request.method,
    url: request.url,
    headers: maskHeaders(request.headers ?? {}),
    hasJson: request.json !== undefined,
    hasForm: Array.isArray(request.form) && request.form.length > 0,
    timeoutMs: request.timeoutMs,
  });
}
