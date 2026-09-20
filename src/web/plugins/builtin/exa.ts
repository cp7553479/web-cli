import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import type { ProviderResponse, SearchRequest } from "../../protocol/types";
import { filterVendorParams } from "../../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl } from "./shared";
import { makeFactory, makeInstance } from "./factory";

const DEFAULT_BASE = "https://api.exa.ai";
const SEARCH_VENDOR_ALLOWLIST = [
  "category",
  "type",
  "userLocation",
  "moderation",
] as const;

const FRESHNESS_TO_DAYS: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export function createExaSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = {
        query: req.query,
        numResults: req.limit,
      };
      if (req.site?.length) body.includeDomains = req.site;
      if (req.freshness) {
        const days = FRESHNESS_TO_DAYS[req.freshness];
        if (days) {
          body.startPublishedDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        }
      }
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/search`,
        headers: { "x-api-key": binding.apiToken ?? "", "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Exa", result);
      const parsed = parseJsonBody("Exa", result) as {
        results?: Array<{ title?: string; url?: string; text?: string; summary?: string; publishedDate?: string }>;
      };
      const items = (parsed.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.summary,
        content: r.text,
        source: "exa",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activate(host: PluginHost): void {
  host.registerFactory("exa", makeFactory(["search"], { search: createExaSearch }));
}
