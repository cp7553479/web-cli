import type { SearchRequest, VendorParams } from "../core/types";
import { parseVendorPairs } from "../providers/vendor-params";

export function mergeSites(site?: string[], sites?: string[]): string[] | undefined {
  const a = [...(site ?? []), ...(sites ?? [])].filter(Boolean);
  return a.length ? [...new Set(a)] : undefined;
}

export function buildSearchRequest(args: {
  text: string;
  limit: number;
  site?: string[];
  sites?: string[];
  countries?: string[];
  freshness?: SearchRequest["freshness"];
  language?: string;
  region?: string;
  country?: string;
  safesearch?: string;
  /** 子命令尾部未知 `--key`（见 parseTrailingLooseVendor）；`--vendor` 同名键覆盖 */
  looseVendor?: Record<string, unknown>;
  vendor?: string[];
}): SearchRequest {
  const vendorParams: VendorParams = {
    ...(args.looseVendor ?? {}),
    ...parseVendorPairs(args.vendor),
  };
  const country =
    args.country ??
    (args.countries?.length ? args.countries.filter(Boolean).join(",") : undefined);
  return {
    query: args.text,
    site: mergeSites(args.site, args.sites),
    limit: args.limit,
    freshness: args.freshness,
    language: args.language,
    region: args.region,
    country,
    safesearch: args.safesearch,
    vendorParams: Object.keys(vendorParams).length ? vendorParams : undefined,
  };
}
