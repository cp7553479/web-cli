/**
 * Base error type for all expected, user-facing failures.
 *
 * Carries a stable `code` (for programmatic consumers and tests) and optional
 * `details` (raw context that must never contain secrets in default output).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Narrows an unknown caught value into a real Error. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(String(value));
}

/** Human-readable message for an unknown caught value. */
export function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value);
}
