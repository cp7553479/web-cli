import { AppError } from "../../core";

export type OutputFormat = "json" | "markdown" | "text";

export interface GlobalFlags {
  format: OutputFormat;
  maxLength: number;
  timeoutMs: number;
}

const VALID_FORMATS: OutputFormat[] = ["json", "markdown", "text"];

function positiveInt(raw: unknown, fallback: number, name: string): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`Invalid value '${raw}' for ${name}. Expected a positive number (e.g. ${fallback}).`, "INVALID_PARAM");
  }
  return Math.round(n);
}

/** Parses the program-level global options into a validated {@link GlobalFlags}. */
export function toGlobalFlags(options: Record<string, unknown>): GlobalFlags {
  const rawFormat = (options.format as string) ?? "text";
  if (!VALID_FORMATS.includes(rawFormat as OutputFormat)) {
    throw new AppError(`Invalid format '${rawFormat}'. Supported: ${VALID_FORMATS.join(", ")}`, "INVALID_PARAM");
  }
  return {
    format: rawFormat as OutputFormat,
    maxLength: positiveInt(options.maxLength, 10000, "--max-length"),
    timeoutMs: positiveInt(options.timeoutMs, 15000, "--timeout-ms"),
  };
}
