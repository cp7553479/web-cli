import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import { ProviderError } from "../../../core";
import type { ProviderResponse, SearchRequest } from "../../protocol/types";
import { filterVendorParams } from "../../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl, toQuery } from "./shared";
import { makeFactory, makeInstance } from "./factory";

const SEARCH_VENDOR_ALLOWLIST = ["categories", "language", "safesearch", "pageno", "time_range"] as const;

export function createSearxngSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      if (!binding.baseUrl) {
        throw new ProviderError(
          "non-retryable-request",
          "searxng: this provider is self-hosted — set base_url on the account to your instance URL.",
        );
      }
      const base = resolveBaseUrl(binding.baseUrl, "");
      const params: Record<string, unknown> = {
        q: req.query,
        format: "json",
      };
      if (req.language) params.language = req.language;
      if (req.safesearch !== undefined) params.safesearch = req.safesearch;
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(params, filtered);
      return {
        method: "GET",
        url: `${base}/search${toQuery(params)}`,
        headers: { Accept: "application/json" },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("SearXNG", result);
      const parsed = parseJsonBody("SearXNG", result) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const items = (parsed.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        source: "searxng",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activate(host: PluginHost): void {
  const factory = makeFactory(["search"], { search: createSearxngSearch });
  factory.config = [
    { key: "base_url", label: "SearXNG instance base URL (e.g. https://searx.example.com)" },
  ];
  host.registerFactory("searxng", factory);
}
