/**
 * Public surface of the portable core abstraction layer.
 *
 * `src/core/**` must never import from `src/web/**` or any other domain code.
 * Domains import from here; the reverse is forbidden.
 */

export { AppError, toError, errorMessage } from "./errors";

export {
  type FailureClass,
  ProviderError,
  classifyHttpStatus,
  type FailureClassifier,
} from "./protocol/classification";

export {
  type ProviderHooks,
  type ProviderInstance,
  type ProviderFactory,
} from "./protocol/provider";

export { ProviderRegistry } from "./protocol/registry";
export { ProviderPool, type ProviderPoolOptions } from "./protocol/pool";
export { PluginHost } from "./protocol/plugin-host";
export type {
  HookCtx,
  AccountCredentials,
  ProviderBinding,
  PoolRunOptions,
} from "./protocol/types";

export {
  type Transport,
  type TransportRequest,
  type TransportResult,
  type TransportFormField,
  maskHeaders,
} from "./transport/transport";
export { CurlTransport, type CurlTransportOptions } from "./transport/curl";

export {
  loadAppConfig,
  loadAppEnv,
  loadCurrentPointer,
  deepMerge,
  resolveEnvTokens,
  type LoadedConfig,
  type LoadAppConfigOptions,
} from "./config/config";
export { getAppPaths, type AppPaths } from "./config/paths";
export type { ConfigValidator } from "./config/validator";

export { runCliProgram, formatError } from "./cli/program";

export { truncate, injectWrap, stringifyJson } from "./output/primitives";

export { FileLogger, errorLog, type Logger } from "./logger/logger";
