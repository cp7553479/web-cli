import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { FetchRequest, ProviderResponse, SearchRequest } from "../protocol/types";
import { filterVendorParams } from "../protocol/vendor-params";
import { bearer, ensureSuccess, parseJsonBody, resolveBaseUrl } from "./_http";
import { makeInstance } from "./_factory";

const DEFAULT_BASE = "https://api.firecrawl.dev";
const SEARCH_VENDOR_ALLOWLIST = ["tbs", "location", "categories", "safe", "scrapeOptions", "ignoreInvalidURLs", "highlights"] as const;
const SCRAPE_VENDOR_ALLOWLIST = [
  "formats",
  "onlyMainContent",
  "includeTags",
  "excludeTags",
  "waitFor",
  "timeout",
  "mobile",
  "actions",
  "location",
  "proxy",
] as const;

const FRESHNESS_TO_TBS: Record<string, string> = {
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
};

export function createFirecrawlSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = { query: req.query, limit: req.limit };
      if (req.site?.length) body.includeDomains = req.site;
      if (req.country) body.country = req.country;
      if (req.freshness) body.tbs = FRESHNESS_TO_TBS[req.freshness] ?? req.freshness;
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/v2/search`,
        headers: { ...bearer(binding.apiToken), "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Firecrawl", result);
      const parsed = parseJsonBody("Firecrawl", result) as {
        data?: {
          web?: Array<{ title?: string; url?: string; markdown?: string; description?: string }>;
          news?: Array<{ title?: string; url?: string; snippet?: string; markdown?: string }>;
        };
      };
      const web = parsed.data?.web ?? [];
      const news = parsed.data?.news ?? [];
      const items = [
        ...web.map((r) => ({ title: r.title, url: r.url, content: r.markdown, snippet: r.description, source: "firecrawl" })),
        ...news.map((r) => ({ title: r.title, url: r.url, content: r.markdown, snippet: r.snippet, source: "firecrawl" })),
      ];
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function createFirecrawlFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = { url: req.urls[0], formats: ["markdown"] };
      if (req.selector) body.includeTags = [req.selector];
      const filtered = filterVendorParams(req.vendorParams, SCRAPE_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/v2/scrape`,
        headers: { ...bearer(binding.apiToken), "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result, req): ProviderResponse {
      ensureSuccess("Firecrawl", result);
      const parsed = parseJsonBody("Firecrawl", result) as {
        data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string; url?: string } };
      };
      const data = parsed.data ?? {};
      return {
        provider: binding.alias,
        items: [
          {
            title: data.metadata?.title,
            url: data.metadata?.url ?? data.metadata?.sourceURL ?? req.urls[0],
            content: data.markdown,
            source: "firecrawl",
          },
        ],
        raw: parsed,
      };
    },
  };
  return makeInstance(binding, hooks);
}
