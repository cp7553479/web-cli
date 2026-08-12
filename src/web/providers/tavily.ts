import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { FetchRequest, ProviderResponse, SearchRequest } from "../protocol/types";
import { filterVendorParams } from "../protocol/vendor-params";
import { bearer, ensureSuccess, parseJsonBody, resolveBaseUrl } from "./_http";
import { makeInstance } from "./_factory";

const DEFAULT_BASE = "https://api.tavily.com";
const SEARCH_VENDOR_ALLOWLIST = [
  "topic",
  "search_depth",
  "chunks_per_source",
  "include_answer",
  "include_raw_content",
  "include_images",
  "include_domains",
  "exclude_domains",
  "start_date",
  "end_date",
  "auto_parameters",
  "exact_match",
  "include_usage",
] as const;
const EXTRACT_VENDOR_ALLOWLIST = [
  "extract_depth",
  "chunks_per_source",
  "query",
  "include_images",
  "include_favicon",
  "timeout",
  "include_usage",
] as const;

const FRESHNESS_TO_RANGE: Record<string, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

export function createTavilySearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = {
        query: req.query,
        max_results: req.limit,
      };
      if (req.site?.length) body.include_domains = req.site;
      if (req.freshness) body.time_range = FRESHNESS_TO_RANGE[req.freshness] ?? req.freshness;
      if (req.country) body.country = req.country;
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/search`,
        headers: { ...bearer(binding.apiToken), "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result, req): ProviderResponse {
      ensureSuccess("Tavily", result);
      const parsed = parseJsonBody("Tavily", result) as {
        results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
        answer?: string;
      };
      const items = (parsed.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        content: r.raw_content,
        source: "tavily",
      }));
      const response: ProviderResponse = { provider: binding.alias, items, raw: parsed };
      if (parsed.answer) {
        response.items = [{ title: "Tavily Answer", content: parsed.answer, source: "tavily" }, ...items];
      }
      return response;
    },
  };
  return makeInstance(binding, hooks);
}

export function createTavilyFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = {
        urls: req.urls,
        format: "markdown",
      };
      const filtered = filterVendorParams(req.vendorParams, EXTRACT_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/extract`,
        headers: { ...bearer(binding.apiToken), "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Tavily", result);
      const parsed = parseJsonBody("Tavily", result) as {
        results?: Array<{ url?: string; raw_content?: string }>;
        failed_results?: Array<{ url?: string; error?: string }>;
      };
      const items = (parsed.results ?? []).map((r) => ({
        url: r.url,
        content: r.raw_content,
        source: "tavily",
      }));
      for (const fail of parsed.failed_results ?? []) {
        items.push({ url: fail.url, content: `Tavily extract failed: ${fail.error ?? "unknown"}`, source: "tavily" });
      }
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}
