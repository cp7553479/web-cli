import { AppError } from "../errors";

/**
 * Internal exception identifiers. The provider pool uses these to decide
 * whether to advance its pointer (try the next account) or stop.
 *
 * `non-retryable-request` short-circuits failover: a request that is wrong for
 * one account is wrong for all, so we never burn the rest of the pool on it.
 */
export type FailureClass =
  | "retryable-credential" // auth/quota tied to this key/account → next account
  | "retryable-transport" // transient network/5xx → next account
  | "non-retryable-request" // bad request shape, 4xx (not 401/429) → stop now
  | "unsupported" // provider cannot serve this request shape → skip, next
  | "unknown"; // unclassified → next account (safe default)

/**
 * A provider failure tagged with its {@link FailureClass}. Providers throw this
 * (or any error + a `classifyFailure` hook) so the pool can route the decision.
 */
export class ProviderError extends AppError {
  constructor(
    public readonly classification: FailureClass,
    message: string,
    details?: unknown,
  ) {
    super(message, "PROVIDER_ERROR", details);
    this.name = "ProviderError";
  }
}

/** A classifier that providers may register via {@link ProviderHooks}. */
export type FailureClassifier = (error: unknown) => FailureClass;

/**
 * Maps an HTTP status code to a default {@link FailureClass}. Providers can use
 * this as a shared baseline inside their own `classifyFailure` hooks.
 */
export function classifyHttpStatus(statusCode: number): FailureClass {
  if (statusCode === 401 || statusCode === 403) return "retryable-credential";
  if (statusCode === 429) return "retryable-transport";
  if (statusCode >= 500) return "retryable-transport";
  if (statusCode >= 400) return "non-retryable-request";
  return "unknown";
}
