import type { SegmentName } from "../protocol/types";

export type { SegmentName };

export interface AccountConfig {
  provider: string;
  api_token?: string;
  base_url?: string;
  enabled?: boolean;
  /** Provider-declared schema fields (see ProviderConfigField), flat strings. */
  [field: string]: string | boolean | undefined;
}

export interface SegmentConfig {
  inject_before?: string;
  inject_after?: string;
  /**
   * Provider selection for this segment. `primary` is the default provider
   * (tried first); `list` orders the remaining fallback providers. Providers
   * not mentioned follow in first-appearance order. Accounts are grouped by
   * this order, declared order within each provider.
   */
  providers?: SegmentProviders;
  account: Record<string, AccountConfig>;
}

export interface SegmentProviders {
  primary?: string;
  list?: string[];
}

export interface RuntimeConfig {
  logging?: boolean;
  /** Cooldown (ms) for an account after a failure. Default: 900000 (15 min). */
  lock_ttl_ms?: number;
  /**
   * Full passes over the account queue before ALL_FAILED. Default: 1 (each
   * account tried at most once — no retry loop).
   */
  retry_rounds?: number;
}

/** Per-provider settings. `enabled: false` disables the provider everywhere. */
export interface ProviderConfig {
  enabled?: boolean;
}

export interface WebConfig {
  runtime?: RuntimeConfig;
  providers?: Record<string, ProviderConfig>;
  search: SegmentConfig;
  fetch: SegmentConfig;
  /** Image-search accounts (`web search-image`). Optional for older configs. */
  images?: SegmentConfig;
  /** LLM accounts for `web ask`. Optional for older configs. */
  ask?: SegmentConfig;
}

export const SEGMENTS: readonly SegmentName[] = ["search", "fetch", "images", "ask"];
