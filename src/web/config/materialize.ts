import {
  ProviderRegistry,
  type PluginHost,
  type ProviderInstance,
} from "../../core";
import type {
  AskRequest,
  FetchRequest,
  ImageSearchRequest,
  ProviderResponse,
  SearchRequest,
} from "../protocol/types";
import type { SegmentName } from "../protocol/types";
import type { SegmentConfig, WebConfig } from "./types";

export interface SkippedAccount {
  segment: SegmentName;
  alias: string;
  provider: string;
  reason: "disabled" | "provider-disabled" | "no-factory" | "capability-unsupported";
}

export interface MaterializedPools {
  searchRegistry: ProviderRegistry<SearchRequest, ProviderResponse>;
  fetchRegistry: ProviderRegistry<FetchRequest, ProviderResponse>;
  imagesRegistry: ProviderRegistry<ImageSearchRequest, ProviderResponse>;
  askRegistry: ProviderRegistry<AskRequest, ProviderResponse>;
  skipped: SkippedAccount[];
}

/**
 * Turns the typed {@link WebConfig} + a populated {@link PluginHost} into
 * capability-specific registries of bound provider instances. Accounts whose
 * provider lacks a registered factory, or whose factory doesn't implement the
 * segment, are recorded in `skipped` (so `web doctor` can surface them)
 * rather than failing the whole load.
 *
 * This is the single place the erased `ProviderInstance<unknown, unknown>` from
 * factories is narrowed back to the segment-specific typed instance.
 */
export function materializeRegistries(config: WebConfig, host: PluginHost): MaterializedPools {
  const searchRegistry = new ProviderRegistry<SearchRequest, ProviderResponse>();
  const fetchRegistry = new ProviderRegistry<FetchRequest, ProviderResponse>();
  const imagesRegistry = new ProviderRegistry<ImageSearchRequest, ProviderResponse>();
  const askRegistry = new ProviderRegistry<AskRequest, ProviderResponse>();
  const skipped: SkippedAccount[] = [];

  bindSegment(config, host, "search", searchRegistry, skipped);
  bindSegment(config, host, "fetch", fetchRegistry, skipped);
  bindSegment(config, host, "images", imagesRegistry, skipped);
  bindSegment(config, host, "ask", askRegistry, skipped);

  return { searchRegistry, fetchRegistry, imagesRegistry, askRegistry, skipped };
}

function bindSegment(
  config: WebConfig,
  host: PluginHost,
  segment: SegmentName,
  registry: ProviderRegistry<unknown, unknown>,
  skipped: SkippedAccount[],
): void {
  const segmentConfig = config[segment] ?? ({ account: {} } as SegmentConfig);
  const rank = providerRank(segmentConfig);
  const entries = Object.entries(segmentConfig.account ?? {})
    // Stable sort: primary provider first, then `providers.list` order, then
    // the rest in first-appearance order; declared order within a provider.
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (rank(a.entry[1].provider) - rank(b.entry[1].provider)) || (a.index - b.index));
  for (const [alias, account] of entries.map((e) => e.entry)) {
    if (account.enabled === false) {
      skipped.push({ segment, alias, provider: account.provider, reason: "disabled" });
      continue;
    }
    if (config.providers?.[account.provider]?.enabled === false) {
      skipped.push({ segment, alias, provider: account.provider, reason: "provider-disabled" });
      continue;
    }
    const factory = host.getFactory(account.provider);
    if (!factory) {
      skipped.push({ segment, alias, provider: account.provider, reason: "no-factory" });
      continue;
    }
    if (!factory.capabilities.includes(segment)) {
      skipped.push({ segment, alias, provider: account.provider, reason: "capability-unsupported" });
      continue;
    }
    const fields: Record<string, string> = {};
    for (const [key, field] of Object.entries(account)) {
      if (key in RESERVED_ACCOUNT_KEYS) continue;
      if (typeof field === "string") fields[key] = field;
    }
    const binding = {
      alias,
      providerName: account.provider,
      apiToken: account.api_token,
      baseUrl: account.base_url,
      fields,
    };
    const instance = factory.create(segment, binding) as ProviderInstance<unknown, unknown>;
    registry.register(segment, instance);
  }
}

const RESERVED_ACCOUNT_KEYS: Record<string, true> = {
  provider: true,
  api_token: true,
  base_url: true,
  enabled: true,
};

/** Maps provider ids to their fallback rank for one segment (lower = earlier). */
function providerRank(segmentConfig: SegmentConfig): (provider: string) => number {
  const order: string[] = [];
  if (segmentConfig.providers?.primary) order.push(segmentConfig.providers.primary);
  for (const id of segmentConfig.providers?.list ?? []) {
    if (!order.includes(id)) order.push(id);
  }
  const explicit = new Map(order.map((id, i) => [id, i]));
  const fallback = new Map<string, number>();
  return (provider: string) => {
    const r = explicit.get(provider);
    if (r !== undefined) return r;
    if (!fallback.has(provider)) fallback.set(provider, 1000 + fallback.size);
    return fallback.get(provider)!;
  };
}
