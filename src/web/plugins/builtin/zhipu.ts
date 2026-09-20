import {
  makeFactory,
  makeInstance,
} from "./factory";
import { createAskInstance } from "./llm/shared";
import { ensureSuccess, parseJsonBody, resolveBaseUrl } from "./shared";
import { filterVendorParams } from "../../protocol/vendor-params";
import type {
  PluginHost,
  ProviderBinding,
  ProviderHooks,
  TransportRequest,
} from "../../../core";
import type {
  AskRequest,
  ProviderResponse,
  SearchRequest,
} from "../../protocol/types";

const DEFAULT_BASE = "https://open.bigmodel.cn/api/paas/v4";
const SEARCH_VENDOR_ALLOWLIST = [
  "search_engine",
  "search_domain_filter",
  "search_recency_filter",
  "content_size",
] as const;

export function createZhipuSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, DEFAULT_BASE);
      const body: Record<string, unknown> = {
        search_query: req.query,
        search_engine: "search_std",
        search_intent: false,
        count: req.limit,
      };
      const filtered = filterVendorParams(req.vendorParams, SEARCH_VENDOR_ALLOWLIST);
      if (filtered) Object.assign(body, filtered);
      return {
        method: "POST",
        url: `${base}/web_search`,
        headers: { Authorization: `Bearer ${binding.apiToken ?? ""}` },
        json: body,
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Zhipu", result);
      const parsed = parseJsonBody("Zhipu", result) as {
        search_result?: Array<{
          title?: string;
          content?: string;
          link?: string;
          media?: string;
          publish_date?: string;
        }>;
      };
      const items = (parsed.search_result ?? []).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.content,
        content: r.media,
        source: "zhipu",
      }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activateZhipu(host: PluginHost): void {
  host.registerFactory(
    "zhipu",
    makeFactory(["ask", "search"], {
      ask: (binding) =>
        createAskInstance(binding, {
          name: "zhipu",
          protocol: "openai-chat",
          defaultBase: DEFAULT_BASE,
          defaultModel: "glm-4.6",
          buildTools: () => [{ type: "web_search", web_search: { enable: true } }],
        }),
      search: createZhipuSearch,
    }),
  );
}
