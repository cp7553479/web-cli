import type { SegmentName } from "../protocol/types";

export type { SegmentName };

export interface AccountConfig {
  provider: string;
  api_token?: string;
  base_url?: string;
  enabled?: boolean;
}

export interface SegmentConfig {
  inject_before?: string;
  inject_after?: string;
  account: Record<string, AccountConfig>;
}

export interface RuntimeConfig {
  logging?: boolean;
}

export interface WebConfig {
  runtime?: RuntimeConfig;
  search: SegmentConfig;
  fetch: SegmentConfig;
}

export const SEGMENTS: readonly SegmentName[] = ["search", "fetch"];
