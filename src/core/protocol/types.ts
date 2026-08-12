import type { Logger } from "../logger/logger";
import type { TransportRequest, TransportResult } from "../transport/transport";

/**
 * Per-attempt context handed to every provider hook. Carries the resolved
 * account credentials (already `{$ENV}`-resolved), the global timeout, and the
 * logger. Hooks must never read the process environment or config directly.
 */
export interface HookCtx {
  account: AccountCredentials;
  timeoutMs: number;
  logger?: Logger;
}

/** The credentials/base-url slice a provider needs to build its HTTP request. */
export interface AccountCredentials {
  alias: string;
  apiToken?: string;
  baseUrl?: string;
}

/**
 * Binding passed to a factory's `create()`. `apiToken` is the already-resolved
 * literal (or undefined if the account declares none).
 */
export interface ProviderBinding extends AccountCredentials {
  providerName: string;
}

/** Options handed to {@link ProviderPool.run}. */
export interface PoolRunOptions {
  /** Capability segment name (domain-defined, e.g. "search" / "fetch"). */
  segment: string;
  /** Pin to one account alias (validates the provider name when combined with `forcedProvider`). */
  forcedAccount?: string;
  /** Pin to an account alias OR a provider type name. */
  forcedProvider?: string;
}

export type { TransportRequest, TransportResult };
