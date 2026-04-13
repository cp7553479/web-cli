import { AppError } from "../core/errors";

export function requirePositiveInt(raw: unknown, name: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(
      `Invalid value '${raw}' for ${name}. Expected a positive integer.`,
      "INVALID_PARAM",
    );
  }
  return Math.round(n);
}

export function requireOneOf<T extends string>(raw: string, allowed: readonly T[], name: string): T {
  if (allowed.includes(raw as T)) return raw as T;
  throw new AppError(
    `Invalid value '${raw}' for ${name}. Supported values: ${allowed.join(", ")}`,
    "INVALID_PARAM",
  );
}

export function rejectConflict(a: string, aSet: boolean, b: string, bSet: boolean): void {
  if (aSet && bSet) {
    throw new AppError(
      `${a} and ${b} cannot be used together. Pick one.`,
      "PARAM_CONFLICT",
    );
  }
}
