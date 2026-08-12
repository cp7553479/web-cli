import { ProviderError, classifyHttpStatus, type TransportResult } from "../../core";

/**
 * Parses a JSON response body or throws a non-retryable ProviderError. Callers
 * should {@link ensureSuccess} first so HTTP errors are classified by status
 * before JSON parsing is attempted.
 */
export function parseJsonBody(provider: string, result: TransportResult): unknown {
  if (!result.bodyText) {
    throw new ProviderError(
      "non-retryable-request",
      `${provider}: empty response body (HTTP ${result.statusCode}).`,
      { statusCode: result.statusCode },
    );
  }
  try {
    return JSON.parse(result.bodyText);
  } catch {
    throw new ProviderError(
      "non-retryable-request",
      `${provider}: response is not valid JSON (HTTP ${result.statusCode}).`,
      { statusCode: result.statusCode, bodyExcerpt: result.bodyText.slice(0, 200) },
    );
  }
}

/**
 * Throws a classified ProviderError when the HTTP status indicates failure.
 * Classification is by status code (see {@link classifyHttpStatus}); the
 * message carries the provider's raw response body excerpt verbatim — every
 * provider's error envelope is shaped differently, and the raw body IS the most
 * informative detail, so we do not parse a provider-specific error field.
 */
export function ensureSuccess(provider: string, result: TransportResult): void {
  if (result.statusCode < 400) return;
  throw new ProviderError(
    classifyHttpStatus(result.statusCode),
    `${provider} HTTP ${result.statusCode}: ${result.bodyText.slice(0, 200) || "(empty body)"}`,
    { statusCode: result.statusCode, bodyExcerpt: result.bodyText.slice(0, 500) },
  );
}

/** Builds a `Bearer` auth header, tolerating a missing token. */
export function bearer(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Picks a base URL, preferring the account's override then the provider default. */
export function resolveBaseUrl(override: string | undefined, fallback: string): string {
  const url = override && override.trim() ? override.trim() : fallback;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Stringifies a value for a query parameter, dropping `undefined`. */
export function toQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
