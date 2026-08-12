import fs from "node:fs";

import {
  AppError,
  getAppPaths,
  loadAppConfig,
  loadCurrentPointer,
  type AppPaths,
  type LoadedConfig,
} from "../../core";
import { DEFAULT_CONFIG_JSON } from "./defaults";
import { webConfigValidator } from "./schema";
import { SEGMENTS, type AccountConfig, type SegmentName, type WebConfig } from "./types";

export { webConfigValidator } from "./schema";
export { DEFAULT_CONFIG_JSON, DEFAULT_ENV_EXAMPLE } from "./defaults";
export { materializeRegistries, type MaterializedPools, type SkippedAccount } from "./materialize";
export type { WebConfig, SegmentConfig, AccountConfig, RuntimeConfig, SegmentName } from "./types";
export { SEGMENTS } from "./types";

export const APP_NAME = ".web";

/**
 * Loads the merged + env-resolved runtime config (global ⊕ project overlay).
 * Auto-creates the default config on first run. Use this for command execution.
 */
export function loadWebConfig(cwd: string = process.cwd()): LoadedConfig<WebConfig> {
  return loadAppConfig({
    appName: APP_NAME,
    validator: webConfigValidator,
    defaultConfigJson: DEFAULT_CONFIG_JSON,
    cwd,
  });
}

/**
 * Loads the GLOBAL config only (no project overlay, no `{$ENV}` resolution) for
 * editing/diagnostic surfaces (`config set`, `config show`, `config doctor`).
 * Tokens stay as literal `{$VAR}` strings.
 */
export function loadGlobalWebConfigRaw(): { config: WebConfig; paths: AppPaths } {
  const paths = getAppPaths(APP_NAME);
  fs.mkdirSync(paths.globalRoot, { recursive: true });
  if (!fs.existsSync(paths.globalConfig)) {
    fs.writeFileSync(paths.globalConfig, DEFAULT_CONFIG_JSON, "utf8");
    if (!fs.existsSync(paths.globalEnv)) {
      fs.writeFileSync(paths.globalEnv, "# Put API keys here\n", "utf8");
    }
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(paths.globalConfig, "utf8"));
  } catch (error) {
    throw new AppError(
      `Failed to parse ${paths.globalConfig}: ${error instanceof Error ? error.message : String(error)}`,
      "CONFIG_PARSE_ERROR",
    );
  }
  return { config: webConfigValidator.validate(raw), paths };
}

/** Atomically writes `config` to the global `~/.web/config.json`. */
export function saveGlobalWebConfig(config: WebConfig, paths?: AppPaths): void {
  const resolvedPaths = paths ?? getAppPaths(APP_NAME);
  fs.mkdirSync(resolvedPaths.globalRoot, { recursive: true });
  const tmp = `${resolvedPaths.globalConfig}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, resolvedPaths.globalConfig);
}

/** Upserts an account entry in a fresh copy of `config`; returns the copy. */
export function setAccount(
  config: WebConfig,
  segment: SegmentName,
  alias: string,
  account: AccountConfig,
): WebConfig {
  requireSegment(segment);
  const next = structuredClone(config);
  ensureSegment(next, segment);
  next[segment].account[alias] = account;
  return next;
}

/** Removes an account entry in a fresh copy of `config`; returns the copy. */
export function removeAccount(config: WebConfig, segment: SegmentName, alias: string): WebConfig {
  requireSegment(segment);
  const next = structuredClone(config);
  ensureSegment(next, segment);
  delete next[segment].account[alias];
  return next;
}

/** Reads the active-account pointer (current.json) for resolved paths. */
export function readActivePointer(paths: AppPaths): Record<string, string> {
  return loadCurrentPointer(paths);
}

/** Writes the active-account pointer (project current.json if a project exists). */
export function writeActivePointer(paths: AppPaths, segment: SegmentName, alias: string): void {
  requireSegment(segment);
  const file = paths.projectCurrent ?? paths.globalCurrent;
  const existing = loadCurrentPointer(paths);
  existing[segment] = alias;
  fs.mkdirSync(file === paths.globalCurrent ? paths.globalRoot : paths.projectRoot ?? paths.globalRoot, {
    recursive: true,
  });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(existing, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

/** Masks an API token for safe display (`abcd****wxyz`). */
export function maskToken(token: string | undefined): string | undefined {
  if (!token) return token;
  if (token.length < 8) return "****";
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

function requireSegment(segment: string): asserts segment is SegmentName {
  if (!SEGMENTS.includes(segment as SegmentName)) {
    throw new AppError(
      `Invalid group '${segment}'. Must be one of: ${SEGMENTS.join(", ")}`,
      "INVALID_PARAM",
    );
  }
}

function ensureSegment(config: WebConfig, segment: SegmentName): void {
  if (!config[segment]) {
    (config as unknown as Record<string, unknown>)[segment] = { account: {} };
  }
  if (!config[segment].account) {
    config[segment].account = {};
  }
}
