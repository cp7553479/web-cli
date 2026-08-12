import { AppError } from "../../core/errors";
import type { SearchRequest, FetchRequest } from "./types";

export const FRESHNESS_VALUES = ["day", "week", "month", "year"] as const;
export const WAIT_UNTIL_VALUES = ["load", "domcontentloaded", "networkidle"] as const;

/** Validates that exactly one of `values` equals `input`, else a flag error. */
export function requireOneOf<T extends string>(input: string, values: readonly T[], flag: string): T {
  if (!values.includes(input as T)) {
    throw new AppError(`Invalid value '${input}' for ${flag}. Expected one of: ${values.join(", ")}`, "INVALID_PARAM");
  }
  return input as T;
}

/** Parses a positive integer flag value or throws a concise error. */
export function requirePositiveInt(raw: unknown, flag: string, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`Invalid value '${raw}' for ${flag}. Expected a positive integer (e.g. ${fallback}).`, "INVALID_PARAM");
  }
  return Math.round(n);
}

/** Rejects when both of two mutually exclusive flags are set. */
export function rejectConflict(aFlag: string, aSet: boolean, bFlag: string, bSet: boolean): void {
  if (aSet && bSet) {
    throw new AppError(`${aFlag} and ${bFlag} cannot be used together.`, "INVALID_PARAM");
  }
}

function mergeSites(site?: string[], sites?: string[]): string[] | undefined {
  const merged = [...(site ?? []), ...(sites ?? [])].filter(Boolean);
  return merged.length ? [...new Set(merged)] : undefined;
}

export interface BuildSearchRequestInput {
  query: string;
  limit: number;
  site?: string[];
  sites?: string[];
  country?: string;
  countries?: string[];
  freshness?: string;
  language?: string;
  region?: string;
  safesearch?: string;
  vendorParams?: Record<string, unknown>;
}

/** Builds and validates a {@link SearchRequest} from CLI-shaped input. */
export function buildSearchRequest(input: BuildSearchRequestInput): SearchRequest {
  const freshness = input.freshness
    ? requireOneOf(input.freshness, FRESHNESS_VALUES, "--freshness")
    : undefined;
  const country =
    input.country ??
    (input.countries?.length ? input.countries.filter(Boolean).join(",") : undefined);
  const vendorParams = Object.keys(input.vendorParams ?? {}).length ? input.vendorParams : undefined;
  return {
    query: input.query,
    site: mergeSites(input.site, input.sites),
    limit: input.limit,
    freshness,
    language: input.language,
    country,
    safesearch: input.safesearch,
    vendorParams,
  };
}

export interface BuildFetchRequestInput {
  urls: string[];
  selector?: string;
  waitUntil?: string;
  vendorParams?: Record<string, unknown>;
}

/** Builds and validates a {@link FetchRequest} from CLI-shaped input. */
export function buildFetchRequest(input: BuildFetchRequestInput): FetchRequest {
  const waitUntil = input.waitUntil
    ? requireOneOf(input.waitUntil, WAIT_UNTIL_VALUES, "--wait-until")
    : undefined;
  const vendorParams = Object.keys(input.vendorParams ?? {}).length ? input.vendorParams : undefined;
  return {
    urls: input.urls,
    selector: input.selector,
    waitUntil,
    vendorParams,
  };
}
