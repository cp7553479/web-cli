import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import type { ImageSearchRequest, ProviderResponse, SearchRequest } from "../../protocol/types";
import { filterVendorParams } from "../../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl } from "./shared";
import { makeFactory, makeInstance } from "./factory";

const DEFAULT_BASE = "https://google.serper.dev";
const SEARCH_VENDOR_ALLOWLIST = ["gl", "hl", "location", "page", "tbs"] as const;
const IMAGES_VENDOR_ALLOWLIST = ["gl", "hl", "location", "page"] as const;

export function createSerperSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      let q = req.query;
      if (req.site?.length) {
        // Serper has no include-domains field; append site: operators to the query.
        q = `${req.query} ${req.site.map((d) => `site:${d}`).join(" ")}`.trim();
      }
      const body: Record<string, unknown> = { q, num: req.limit };
      if (req.country) body.gl = req.country;
      if (req.language) body.hl = req.language;
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/search`,
        headers: { "X-API-KEY": binding.apiToken ?? "", "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Serper", result);
      const parsed = parseJsonBody("Serper", result) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
      };
      const items = (parsed.organic ?? []).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        source: "serper",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function createSerperImageSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<ImageSearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = { q: req.query, num: req.limit };
      const filtered = filterVendorParams(req.vendorParams, IMAGES_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/images`,
        headers: { "X-API-KEY": binding.apiToken ?? "", "Content-Type": "application/json" },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Serper", result);
      const parsed = parseJsonBody("Serper", result) as {
        images?: Array<{ title?: string; imageUrl?: string; link?: string; source?: string }>;
      };
      const items = (parsed.images ?? []).map((r) => ({
        title: r.title,
        url: r.imageUrl,
        snippet: r.source,
        content: r.link,
        source: "serper",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activate(host: PluginHost): void {
  host.registerFactory(
    "serper",
    makeFactory(["search", "images"], {
      search: createSerperSearch,
      images: createSerperImageSearch,
    }),
  );
}
