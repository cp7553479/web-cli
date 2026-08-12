import {
  ProviderRegistry,
  type PluginHost,
  type ProviderInstance,
} from "../../core";
import type { FetchRequest, ProviderResponse, SearchRequest } from "../protocol/types";
import type { SegmentName } from "../protocol/types";
import type { WebConfig } from "./types";

export interface SkippedAccount {
  segment: SegmentName;
  alias: string;
  provider: string;
  reason: "disabled" | "no-factory" | "capability-unsupported";
}

export interface MaterializedPools {
  searchRegistry: ProviderRegistry<SearchRequest, ProviderResponse>;
  fetchRegistry: ProviderRegistry<FetchRequest, ProviderResponse>;
  skipped: SkippedAccount[];
}

/**
 * Turns the typed {@link WebConfig} + a populated {@link PluginHost} into two
 * capability-specific registries of bound provider instances. Accounts whose
 * provider lacks a registered factory, or whose factory doesn't implement the
 * segment, are recorded in `skipped` (so `web config doctor` can surface them)
 * rather than failing the whole load.
 *
 * This is the single place the erased `ProviderInstance<unknown, unknown>` from
 * factories is narrowed back to the segment-specific typed instance.
 */
export function materializeRegistries(config: WebConfig, host: PluginHost): MaterializedPools {
  const searchRegistry = new ProviderRegistry<SearchRequest, ProviderResponse>();
  const fetchRegistry = new ProviderRegistry<FetchRequest, ProviderResponse>();
  const skipped: SkippedAccount[] = [];

  bindSegment(config, host, "search", searchRegistry, skipped);
  bindSegment(config, host, "fetch", fetchRegistry, skipped);

  return { searchRegistry, fetchRegistry, skipped };
}

function bindSegment(
  config: WebConfig,
  host: PluginHost,
  segment: SegmentName,
  registry: ProviderRegistry<unknown, unknown>,
  skipped: SkippedAccount[],
): void {
  const accounts = config[segment].account ?? {};
  for (const [alias, account] of Object.entries(accounts)) {
    if (account.enabled === false) {
      skipped.push({ segment, alias, provider: account.provider, reason: "disabled" });
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
    const binding = {
      alias,
      providerName: account.provider,
      apiToken: account.api_token,
      baseUrl: account.base_url,
    };
    const instance = factory.create(segment, binding) as ProviderInstance<unknown, unknown>;
    registry.register(segment, instance);
  }
}
