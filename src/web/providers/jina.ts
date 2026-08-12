import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { FetchRequest, ProviderResponse, SearchRequest } from "../protocol/types";
import { filterVendorParams } from "../protocol/vendor-params";
import { bearer, ensureSuccess, parseJsonBody } from "./_http";
import { makeInstance } from "./_factory";

const SEARCH_HOST = "https://s.jina.ai";
const READER_HOST = "https://r.jina.ai";

const SEARCH_VENDOR_ALLOWLIST = ["no-cache", "cookie"] as const;
const READER_VENDOR_ALLOWLIST = [
  "x-respond-with",
  "x-target-selector",
  "x-wait-for-selector",
  "x-timeout",
  "x-with-generated-alt",
  "x-no-cache",
  "x-engine",
  "x-max-tokens",
  "x-retain-images",
  "x-retain-links",
] as const;

export function createJinaSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      let url = `${SEARCH_HOST}/${encodeURIComponent(req.query)}`;
      const siteParams = req.site?.length ? `?site=${encodeURIComponent(req.site.join(","))}` : "";
      url += siteParams;
      const headers: Record<string, string> = { ...bearer(binding.apiToken), Accept: "application/json" };
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) for (const [k, v] of Object.entries(filtered)) headers[k] = String(v);
      return { method: "GET", url, headers };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Jina", result);
      const parsed = parseJsonBody("Jina", result) as {
        data?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const items = (parsed.data ?? []).map((d) => ({
        title: d.title,
        url: d.url,
        content: d.content,
        source: "jina",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function createJinaFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const target = req.urls[0];
      const url = `${READER_HOST}/${target}`;
      const headers: Record<string, string> = {
        ...bearer(binding.apiToken),
        Accept: "application/json",
        "x-respond-with": "markdown",
      };
      if (req.selector) headers["x-target-selector"] = req.selector;
      const filtered = filterVendorParams(req.vendorParams, READER_VENDOR_ALLOWLIST);
      if (filtered) for (const [k, v] of Object.entries(filtered)) headers[k] = String(v);
      return { method: "GET", url, headers };
    },
    parseResponse(result, req): ProviderResponse {
      ensureSuccess("Jina", result);
      const parsed = parseJsonBody("Jina", result) as {
        data?: { title?: string; url?: string; content?: string };
      };
      const data = parsed.data ?? {};
      return {
        provider: binding.alias,
        items: [{ title: data.title, url: data.url ?? req.urls[0], content: data.content, source: "jina" }],
        raw: parsed,
      };
    },
  };
  return makeInstance(binding, hooks);
}
