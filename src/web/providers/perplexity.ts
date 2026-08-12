import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { ProviderResponse, SearchRequest } from "../protocol/types";
import { filterVendorParams } from "../protocol/vendor-params";
import { bearer, ensureSuccess, parseJsonBody, resolveBaseUrl } from "./_http";
import { makeInstance } from "./_factory";

const DEFAULT_BASE = "https://api.perplexity.ai";
const DEFAULT_MODEL = "sonar";
const SEARCH_VENDOR_ALLOWLIST = [
  "model",
  "search_mode",
  "search_recency_filter",
  "search_domain_filter",
  "search_language_filter",
  "return_related_questions",
  "return_images",
  "reasoning_effort",
  "max_tokens",
  "temperature",
] as const;

const FRESHNESS_TO_RECENCY: Record<string, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

export function createPerplexitySearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = {
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: req.query }],
      };
      if (req.freshness) body.search_recency_filter = FRESHNESS_TO_RECENCY[req.freshness] ?? req.freshness;
      if (req.site?.length) body.search_domain_filter = req.site;
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/v1/sonar`,
        headers: { ...bearer(binding.apiToken), "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Perplexity", result);
      const parsed = parseJsonBody("Perplexity", result) as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
        search_results?: Array<{ title?: string; url?: string; snippet?: string; date?: string }>;
      };
      const answer = parsed.choices?.[0]?.message?.content;
      const items = (parsed.search_results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: "perplexity",
      }));
      const finalItems = answer
        ? [{ title: "Perplexity Answer", content: answer, source: "perplexity" }, ...items]
        : items;
      return { provider: binding.alias, items: finalItems, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}
