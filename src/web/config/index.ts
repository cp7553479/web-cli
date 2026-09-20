import fs from "node:fs";
import path from "node:path";

import {
  AppError,
  getAppPaths,
  loadAppConfig,
  loadCurrentPointer,
  type AppPaths,
  type LoadedConfig,
} from "../../core";
import { DEFAULT_CONFIG_JSON, DEFAULT_ENV_EXAMPLE } from "./defaults";
import { installSkills } from "./skills";
import { webConfigValidator } from "./schema";
import { SEGMENTS, type AccountConfig, type SegmentConfig, type SegmentName, type WebConfig } from "./types";

export { webConfigValidator } from "./schema";
export { DEFAULT_CONFIG_JSON, DEFAULT_ENV_EXAMPLE } from "./defaults";
export { installSkills, getSkillInstallDirs, type SkillInstallResult } from "./skills";
export { materializeRegistries, type MaterializedPools, type SkippedAccount } from "./materialize";
export type { WebConfig, SegmentConfig, SegmentProviders, AccountConfig, RuntimeConfig, SegmentName } from "./types";
export { SEGMENTS } from "./types";

export const APP_NAME = ".web";

/**
 * First-run bootstrap: writes the default global config + .env and installs
 * the bundled agent skills. Idempotent — only fills what is missing. Returns
 * true when this call created the global config (i.e. this WAS the first run).
 */
export function ensureBootstrapped(paths: AppPaths): boolean {
  if (fs.existsSync(paths.globalConfig)) return false;
  fs.mkdirSync(paths.globalRoot, { recursive: true });
  fs.writeFileSync(paths.globalConfig, DEFAULT_CONFIG_JSON, "utf8");
  if (!fs.existsSync(paths.globalEnv)) {
    fs.writeFileSync(paths.globalEnv, DEFAULT_ENV_EXAMPLE, "utf8");
  }
  const skills = installSkills();
  const targets = [...new Set(skills.created.map((p) => path.dirname(p)))];
  if (targets.length) {
    process.stderr.write(`web: initialized ${paths.globalRoot} (skills -> ${targets.join(", ")})\n`);
  }
  return true;
}

/**
 * Loads the merged + env-resolved runtime config (project scope when present,
 * otherwise global). Auto-initializes `~/.web` (config + .env + skills) on
 * first run. Use this for command execution.
 */
export function loadWebConfig(cwd: string = process.cwd()): LoadedConfig<WebConfig> {
  const paths = getAppPaths(APP_NAME, cwd);
  ensureBootstrapped(paths);
  return loadAppConfig({
    appName: APP_NAME,
    validator: webConfigValidator,
    defaultConfigJson: DEFAULT_CONFIG_JSON,
    cwd,
  });
}

/**
 * Loads the ACTIVE config (project `./.web/config.json` when present, else
 * global `~/.web/config.json`) without `{$ENV}` resolution, for
 * editing/diagnostic surfaces (`config set`, `config show`, `web doctor`).
 * Tokens stay as literal `{$VAR}` strings. Auto-initializes on first run.
 */
export function loadActiveConfigRaw(cwd: string = process.cwd()): {
  config: WebConfig;
  paths: AppPaths;
  scope: "project" | "global";
} {
  const paths = getAppPaths(APP_NAME, cwd);
  ensureBootstrapped(paths);
  const active = paths.projectConfig ?? paths.globalConfig;
  const scope: "project" | "global" = paths.projectConfig ? "project" : "global";
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(active, "utf8"));
  } catch (error) {
    throw new AppError(
      `Failed to parse ${active}: ${error instanceof Error ? error.message : String(error)}`,
      "CONFIG_PARSE_ERROR",
    );
  }
  return { config: webConfigValidator.validate(raw), paths, scope };
}

/** Atomically writes `config` to the active config path (project when present). */
export function saveActiveConfig(config: WebConfig, paths?: AppPaths): void {
  const resolvedPaths = paths ?? getAppPaths(APP_NAME);
  const target = resolvedPaths.projectConfig ?? resolvedPaths.globalConfig;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, target);
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
  ensureSegment(next, segment).account[alias] = account;
  return next;
}

/** Removes an account entry in a fresh copy of `config`; returns the copy. */
export function removeAccount(config: WebConfig, segment: SegmentName, alias: string): WebConfig {
  requireSegment(segment);
  const next = structuredClone(config);
  delete ensureSegment(next, segment).account[alias];
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

function ensureSegment(config: WebConfig, segment: SegmentName): SegmentConfig {
  if (!config[segment]) {
    config[segment] = { account: {} };
  }
  const seg = config[segment]!;
  if (!seg.account) {
    seg.account = {};
  }
  return seg;
}
