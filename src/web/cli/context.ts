import {
  CurlTransport,
  FileLogger,
  PluginHost,
  ProviderPool,
  ProviderRegistry,
  loadCurrentPointer,
  type AppPaths,
} from "../../core";
import {
  APP_NAME,
  loadWebConfig,
  materializeRegistries,
  type MaterializedPools,
  type WebConfig,
} from "../config";
import { loadPlugins } from "../plugins";
import type {
  AskRequest,
  FetchRequest,
  ImageSearchRequest,
  ProviderResponse,
  SearchRequest,
} from "../protocol/types";
import type { GlobalFlags } from "./global-flags";

export interface AppContext {
  config: WebConfig;
  paths: AppPaths;
  searchPool: ProviderPool<SearchRequest, ProviderResponse>;
  fetchPool: ProviderPool<FetchRequest, ProviderResponse>;
  imagesPool: ProviderPool<ImageSearchRequest, ProviderResponse>;
  askPool: ProviderPool<AskRequest, ProviderResponse>;
  fetchRegistry: ProviderRegistry<FetchRequest, ProviderResponse>;
  /** The loaded plugin host — lets commands reach factories directly (fallbacks). */
  host: PluginHost;
  logger?: FileLogger;
  skipped: MaterializedPools["skipped"];
}

/**
 * Wires the full runtime for one CLI invocation: load config, register built-in
 * + external provider factories, materialize two capability-specific pools
 * (search, fetch), and attach a curl transport + file logger. The active-account
 * pointer (`current.json`) feeds both pools' `preferred` resolver.
 */
export function createAppContext(flags: GlobalFlags, cwd: string = process.cwd()): AppContext {
  const { config, paths } = loadWebConfig(cwd);

  const host = new PluginHost();
  loadPlugins(host, cwd);

  const { searchRegistry, fetchRegistry, imagesRegistry, askRegistry, skipped } = materializeRegistries(config, host);
  const loggingEnabled = config.runtime?.logging !== false;
  const logger = loggingEnabled ? new FileLogger(paths.logsDir) : undefined;
  const transport = new CurlTransport({ logger });
  const current = loadCurrentPointer(paths);
  const preferred = (segment: string) => current[segment];
  const lockTtlMs = config.runtime?.lock_ttl_ms;
  const rounds = config.runtime?.retry_rounds;

  const searchPool = new ProviderPool<SearchRequest, ProviderResponse>(searchRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
    lockFile: paths.lockFile,
    lockTtlMs,
    rounds,
  });
  const fetchPool = new ProviderPool<FetchRequest, ProviderResponse>(fetchRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
    lockFile: paths.lockFile,
    lockTtlMs,
    rounds,
  });
  const imagesPool = new ProviderPool<ImageSearchRequest, ProviderResponse>(imagesRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
    lockFile: paths.lockFile,
    lockTtlMs,
    rounds,
  });

  const askPool = new ProviderPool<AskRequest, ProviderResponse>(askRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
    lockFile: paths.lockFile,
    lockTtlMs,
    rounds,
  });

  return { config, paths, searchPool, fetchPool, imagesPool, askPool, fetchRegistry, host, logger, skipped };
}

export { APP_NAME };
