import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import type { ImageSearchRequest, ProviderResponse } from "../../protocol/types";
import { filterVendorParams } from "../../protocol/vendor-params";
import { ensureSuccess, parseJsonBody, resolveBaseUrl, toQuery } from "./shared";
import { makeFactory, makeInstance } from "./factory";

const DEFAULT_BASE = "https://api.pexels.com/v1";
const IMAGES_VENDOR_ALLOWLIST = ["orientation", "size", "color", "page"] as const;

export function createPexelsImageSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<ImageSearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const params: Record<string, unknown> = {
        query: req.query,
        per_page: req.limit,
      };
      const filtered = filterVendorParams(req.vendorParams, IMAGES_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(params, filtered);
      return {
        method: "GET",
        url: `${base}/search${toQuery(params)}`,
        headers: { Authorization: binding.apiToken ?? "", Accept: "application/json" },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Pexels", result);
      const parsed = parseJsonBody("Pexels", result) as {
        photos?: Array<{
          alt?: string;
          photographer?: string;
          url?: string;
          src?: { large2x?: string; large?: string; original?: string };
        }>;
      };
      const items = (parsed.photos ?? []).map((p) => ({
        title: p.alt ?? p.photographer,
        url: p.src?.large2x ?? p.src?.large ?? p.src?.original,
        snippet: p.photographer,
        content: p.url,
        source: "pexels",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activate(host: PluginHost): void {
  host.registerFactory("pexels", makeFactory(["images"], { images: createPexelsImageSearch }));
}
