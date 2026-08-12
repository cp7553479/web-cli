import {
  CurlTransport,
  FileLogger,
  PluginHost,
  ProviderPool,
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
import { registerBuiltinFactories } from "../providers";
import { loadExternalPlugins } from "../plugins/external";
import type { FetchRequest, ProviderResponse, SearchRequest } from "../protocol/types";
import type { GlobalFlags } from "./global-flags";

export interface AppContext {
  config: WebConfig;
  paths: AppPaths;
  searchPool: ProviderPool<SearchRequest, ProviderResponse>;
  fetchPool: ProviderPool<FetchRequest, ProviderResponse>;
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
  registerBuiltinFactories(host);
  loadExternalPlugins(host, cwd);

  const { searchRegistry, fetchRegistry, skipped } = materializeRegistries(config, host);

  const loggingEnabled = config.runtime?.logging !== false;
  const logger = loggingEnabled ? new FileLogger(paths.logsDir) : undefined;
  const transport = new CurlTransport({ logger });
  const current = loadCurrentPointer(paths);
  const preferred = (segment: string) => current[segment];

  const searchPool = new ProviderPool<SearchRequest, ProviderResponse>(searchRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
  });
  const fetchPool = new ProviderPool<FetchRequest, ProviderResponse>(fetchRegistry, transport, {
    timeoutMs: flags.timeoutMs,
    logger,
    preferred,
  });

  return { config, paths, searchPool, fetchPool, logger, skipped };
}

export { APP_NAME };
