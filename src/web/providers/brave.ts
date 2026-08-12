import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { ProviderResponse, SearchRequest } from "../protocol/types";
import { filterVendorParams } from "../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl, toQuery } from "./_http";
import { makeInstance } from "./_factory";

const DEFAULT_BASE = "https://api.search.brave.com";
const SEARCH_VENDOR_ALLOWLIST = [
  "search_lang",
  "ui_lang",
  "offset",
  "spellcheck",
  "text_decorations",
  "result_filter",
  "units",
  "extra_snippets",
  "summary",
  "goggles",
  "operators",
] as const;

const FRESHNESS_TO_BRAVE: Record<string, string> = {
  day: "pd",
  week: "pw",
  month: "pm",
  year: "py",
};

export function createBraveSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const params: Record<string, unknown> = {
        q: req.query,
        count: req.limit,
      };
      if (req.country) params.country = req.country;
      if (req.freshness) params.freshness = FRESHNESS_TO_BRAVE[req.freshness] ?? req.freshness;
      if (req.safesearch !== undefined) params.safesearch = req.safesearch;
      if (req.site?.length) {
        // Brave has no include-domains field; append site: operators to the query.
        const ops = req.site.map((d) => `site:${d}`).join(" ");
        params.q = `${req.query} ${ops}`.trim();
      }
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(params, filtered);
      return {
        method: "GET",
        url: `${base}/res/v1/web/search${toQuery(params)}`,
        headers: binding.apiToken ? { "X-Subscription-Token": binding.apiToken, Accept: "application/json" } : { Accept: "application/json" },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Brave", result);
      const parsed = parseJsonBody("Brave", result) as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string; extra_snippets?: string[] }> };
      };
      const items = (parsed.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        content: r.extra_snippets?.join("\n"),
        source: "brave",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}
