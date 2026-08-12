import fs from "node:fs";

import { AppError } from "../errors";
import { getAppPaths, readCurrentPointer, readJsonRecord, type AppPaths } from "./paths";
import type { ConfigValidator } from "./validator";

export interface LoadAppConfigOptions<T> {
  /** App/dir name, e.g. `".web"` (must start with a dot by convention). */
  appName: string;
  /** Domain validator that turns raw merged JSON into typed `T`. */
  validator: ConfigValidator<T>;
  /** Environment override (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** cwd override (defaults to `process.cwd()`). */
  cwd?: string;
  /**
   * JSON written verbatim to the global config path when it does not yet exist.
   * Lets the loader bootstrap a first-run config without core knowing the shape.
   */
  defaultConfigJson?: string;
  /** When true, do not auto-create a missing config; let the domain handle it. */
  allowMissing?: boolean;
}

export interface LoadedConfig<T> {
  config: T;
  paths: AppPaths;
}

/**
 * Generic config loader. Resolves the global + optional project overlay,
 * deep-merges them, parses `.env` files (process.env ⊂ global ⊂ project),
 * resolves `{$ENV_VAR}` whole-field tokens, then hands the result to the
 * domain validator. Core remains fully schema-agnostic.
 */
export function loadAppConfig<T>(options: LoadAppConfigOptions<T>): LoadedConfig<T> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const paths = getAppPaths(options.appName, cwd);

  ensureGlobalRoot(paths);

  if (!fs.existsSync(paths.globalConfig)) {
    if (options.defaultConfigJson !== undefined) {
      fs.writeFileSync(paths.globalConfig, options.defaultConfigJson, "utf8");
      if (!fs.existsSync(paths.globalEnv)) {
        fs.writeFileSync(paths.globalEnv, "# Put API keys here, e.g. TAVILY_API_KEY=...\n", "utf8");
      }
    } else if (!options.allowMissing) {
      throw new AppError(
        `Missing config at ${paths.globalConfig}. Run \`${options.appName.replace(".", "")} config init\` first.`,
        "CONFIG_MISSING",
      );
    }
  }

  const globalRaw = readJson(paths.globalConfig, options.appName);
  const projectRaw = paths.projectConfig && fs.existsSync(paths.projectConfig)
    ? readJson(paths.projectConfig, options.appName)
    : undefined;

  const merged = projectRaw ? deepMerge(globalRaw, projectRaw) : globalRaw;

  const envLayer = mergeEnvLayers(env, paths);
  const resolved = resolveEnvTokens(merged, envLayer);

  return { config: options.validator.validate(resolved), paths };
}

/** Reads `current.json` for the resolved paths (active-account pointer). */
export function loadCurrentPointer(paths: AppPaths): Record<string, string> {
  return readCurrentPointer(paths);
}

function ensureGlobalRoot(paths: AppPaths): void {
  fs.mkdirSync(paths.globalRoot, { recursive: true });
}

function readJson(file: string, appName: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new AppError(`Failed to read config ${file}: ${message(error)}`, "CONFIG_READ_ERROR");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AppError(
      `Failed to parse ${file} as JSON: ${message(error)}\nRe-run \`${appName.replace(".", "")} config init --force\` to reset.`,
      "CONFIG_PARSE_ERROR",
    );
  }
}

/**
 * Generic deep merge. For keys present in both: if both values are plain
 * objects, recurse (this unions `account` maps with overlay entries winning on
 * alias collision); otherwise the overlay value wins. Arrays replace.
 */
export function deepMerge(base: unknown, overlay: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      out[key] = key in out ? deepMerge(out[key], value) : value;
    }
    return out;
  }
  return overlay;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Layers environment sources: `process.env` (base) ← global `.env` ← project
 * `.env` (later wins). Returns a flat string map. Core ships a minimal parser
 * (no `dotenv` dependency).
 */
function mergeEnvLayers(
  processEnv: Record<string, string | undefined>,
  paths: AppPaths,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...processEnv };
  for (const file of [paths.globalEnv, paths.projectEnv]) {
    if (!file || !fs.existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseDotenv(fs.readFileSync(file, "utf8")))) {
      merged[key] = value;
    }
  }
  return merged;
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Recursively replaces any string value that is exactly `{$VAR}` with the
 * resolved environment value. Only whole-field tokens are substituted, so URLs
 * or text that merely contain `${...}` are left untouched. Missing env is a
 * hard error.
 */
export function resolveEnvTokens(
  value: unknown,
  env: Record<string, string | undefined>,
): unknown {
  if (typeof value === "string") {
    const match = value.match(/^\{\$([A-Z0-9_]+)\}$/);
    if (!match) return value;
    const envName = match[1];
    const resolved = env[envName];
    if (resolved === undefined || resolved === "") {
      throw new AppError(
        `Environment variable '${envName}' is not set (referenced via {\$${envName}} in config).\n  Fix: add ${envName}=your_key to ~/.<app>/.env, or set the account enabled=false.`,
        "ENV_TOKEN_NOT_FOUND",
      );
    }
    return resolved;
  }
  if (Array.isArray(value)) return value.map((v) => resolveEnvTokens(v, env));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveEnvTokens(v, env);
    }
    return out;
  }
  return value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
