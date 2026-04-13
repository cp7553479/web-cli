import { AppError } from "../core/errors";
import type { GlobalFlags, OutputFormat } from "../core/types";

const VALID_FORMATS: OutputFormat[] = ["json", "markdown", "text"];

function parsePositiveInt(raw: unknown, fallback: number, name: string): number {
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      `Invalid value '${raw}' for ${name}. Expected a positive number (e.g. ${fallback}).`,
      "INVALID_PARAM",
    );
  }
  return Math.round(n);
}

export function toGlobalFlags(options: Record<string, unknown>): GlobalFlags {
  const rawFormat = (options.format as string) ?? "text";
  if (!VALID_FORMATS.includes(rawFormat as OutputFormat)) {
    throw new AppError(
      `Invalid format '${rawFormat}'. Supported formats: ${VALID_FORMATS.join(", ")}`,
      "INVALID_PARAM",
    );
  }
  return {
    format: rawFormat as OutputFormat,
    stdout: Boolean(options.stdout ?? false),
    maxLength: parsePositiveInt(options.maxLength, 10000, "--max-length"),
    timeoutMs: parsePositiveInt(options.timeoutMs, 15000, "--timeout-ms"),
  };
}

