import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import type { ImageSearchRequest, ProviderResponse } from "../../protocol/types";
import { filterVendorParams } from "../../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl, toQuery } from "./shared";
import { makeFactory, makeInstance } from "./factory";

const DEFAULT_BASE = "https://pixabay.com/api";
const IMAGES_VENDOR_ALLOWLIST = ["image_type", "category", "lang", "colors", "orientation", "min_width", "min_height"] as const;

export function createPixabayImageSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<ImageSearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const params: Record<string, unknown> = {
        key: binding.apiToken ?? "",
        q: req.query,
        per_page: req.limit,
        safesearch: "true",
      };
      const filtered = filterVendorParams(req.vendorParams, IMAGES_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(params, filtered);
      return {
        method: "GET",
        url: `${base}/${toQuery(params)}`,
        headers: { Accept: "application/json" },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Pixabay", result);
      const parsed = parseJsonBody("Pixabay", result) as {
        hits?: Array<{
          webformatURL?: string;
          largeImageURL?: string;
          pageURL?: string;
          tags?: string;
          type?: string;
        }>;
      };
      const items = (parsed.hits ?? []).map((h) => ({
        title: h.tags,
        url: h.largeImageURL ?? h.webformatURL,
        snippet: h.pageURL,
        source: "pixabay",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activate(host: PluginHost): void {
  host.registerFactory("pixabay", makeFactory(["images"], { images: createPixabayImageSearch }));
}
