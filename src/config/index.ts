import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import dotenv from "dotenv";

import type { ZodError } from "zod";

import { AppError } from "../core/errors";
import { webConfigSchema } from "./schema";
import type { GroupConfig, GroupName, ModelConfig, WebConfig } from "./types";
import { defaultConfig } from "./defaults";
export type { ResolveForcedAccountOpts } from "./resolve-accounts";
export { resolveForcedAccountOrder } from "./resolve-accounts";

function formatZodErrors(error: ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

export interface ConfigPaths {
  rootDir: string;
  configPath: string;
  envPath: string;
}

/** @iarna/toml 会在 table 上挂 Symbol 键，Zod record 不接受，合并/校验前需剥掉。 */
export function deepStripTomlSymbols(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepStripTomlSymbols);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as object)) {
    out[k] = deepStripTomlSymbols((value as Record<string, unknown>)[k]);
  }
  return out;
}

export function getConfigPaths(): ConfigPaths {
  const raw = process.env.WEB_HOME?.trim();
  const rootDir = raw && raw.length > 0 ? path.resolve(raw) : path.join(os.homedir(), ".web");
  return {
    rootDir,
    configPath: path.join(rootDir, "config.toml"),
    envPath: path.join(rootDir, ".env"),
  };
}

export function ensureConfigDir(): ConfigPaths {
  const paths = getConfigPaths();
  fs.mkdirSync(paths.rootDir, { recursive: true });
  return paths;
}

/** 当前工作目录下可选的项目级配置根目录（存在 config.toml 时才参与 TOML 合并）。 */
export function getProjectWebRoot(cwd = process.cwd()): string {
  return path.join(cwd, ".web");
}

export function getProjectConfigPaths(cwd = process.cwd()): ConfigPaths | null {
  const rootDir = getProjectWebRoot(cwd);
  const configPath = path.join(rootDir, "config.toml");
  if (!fs.existsSync(configPath)) return null;
  return {
    rootDir,
    configPath,
    envPath: path.join(rootDir, ".env"),
  };
}

/** 全局 ~/.web 为默认；项目 ./.web/config.toml 与 ./.web/.env 覆写同名键 / 合并 account。 */
export function deepMergeWebTomlLayer(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  const groups = ["search", "fetch", "research", "answer"] as const;
  for (const g of groups) {
    if (overlay[g] === undefined || overlay[g] === null) continue;
    const b = (base[g] as Record<string, unknown> | undefined) ?? {};
    const o = overlay[g] as Record<string, unknown>;
    out[g] = {
      ...b,
      ...o,
      account: { ...(b.account as Record<string, unknown>), ...((o.account as Record<string, unknown>) ?? {}) },
    };
  }
  if (overlay.runtime !== undefined && overlay.runtime !== null) {
    const br = (base.runtime as Record<string, unknown> | undefined) ?? {};
    const or = overlay.runtime as Record<string, unknown>;
    out.runtime = { ...br, ...or };
  }
  return out;
}

export function loadConfig(cwd = process.cwd()): WebConfig {
  const paths = ensureConfigDir();
  if (!fs.existsSync(paths.configPath)) {
    const initial = defaultConfig();
    fs.writeFileSync(paths.configPath, stringifyToml(initial as any), "utf8");
    if (!fs.existsSync(paths.envPath)) {
      fs.writeFileSync(paths.envPath, "# Put tokens here\n", "utf8");
    }
  }

  const globalRaw = fs.readFileSync(paths.configPath, "utf8");
  let mergedObj = deepStripTomlSymbols(parseToml(globalRaw)) as Record<string, unknown>;
  const projectPaths = getProjectConfigPaths(cwd);
  if (projectPaths) {
    const projectRaw = fs.readFileSync(projectPaths.configPath, "utf8");
    mergedObj = deepMergeWebTomlLayer(mergedObj, deepStripTomlSymbols(parseToml(projectRaw)) as Record<string, unknown>);
  }

  const result = webConfigSchema.safeParse(mergedObj);
  if (!result.success) {
    throw new AppError(
      `Config file validation failed (${paths.configPath}).\n${formatZodErrors(result.error)}`,
      "CONFIG_SCHEMA_ERROR",
    );
  }

  const envGlobal = fs.existsSync(paths.envPath) ? dotenv.parse(fs.readFileSync(paths.envPath, "utf8")) : {};
  const envProject =
    projectPaths && fs.existsSync(projectPaths.envPath)
      ? dotenv.parse(fs.readFileSync(projectPaths.envPath, "utf8"))
      : {};
  const mergedEnv = { ...process.env, ...envGlobal, ...envProject };
  const resolved = resolveConfigEnvTokens(result.data as WebConfig, mergedEnv);
  return resolved;
}

/** 仅 ~/.web（不合并 cwd/.web），供 onboard 等只编辑全局配置的场景。 */
export function loadGlobalWebConfig(): WebConfig {
  const paths = ensureConfigDir();
  if (!fs.existsSync(paths.configPath)) {
    const initial = defaultConfig();
    fs.writeFileSync(paths.configPath, stringifyToml(initial as any), "utf8");
    if (!fs.existsSync(paths.envPath)) {
      fs.writeFileSync(paths.envPath, "# Put tokens here\n", "utf8");
    }
  }
  const globalRaw = fs.readFileSync(paths.configPath, "utf8");
  const mergedObj = deepStripTomlSymbols(parseToml(globalRaw)) as Record<string, unknown>;
  const result = webConfigSchema.safeParse(mergedObj);
  if (!result.success) {
    throw new AppError(
      `Config file validation failed (${paths.configPath}).\n${formatZodErrors(result.error)}`,
      "CONFIG_SCHEMA_ERROR",
    );
  }
  const envGlobal = fs.existsSync(paths.envPath) ? dotenv.parse(fs.readFileSync(paths.envPath, "utf8")) : {};
  const mergedEnv = { ...process.env, ...envGlobal };
  const resolved = resolveConfigEnvTokens(result.data as WebConfig, mergedEnv);
  return resolved;
}

/** 解析 ~/.web/config.toml，不解析 {$ENV}（避免未设 env 时 onboard 预填失败）。 */
export function readGlobalWebConfigToml(): WebConfig {
  const paths = ensureConfigDir();
  if (!fs.existsSync(paths.configPath)) {
    const initial = defaultConfig();
    fs.writeFileSync(paths.configPath, stringifyToml(initial as any), "utf8");
  }
  const globalRaw = fs.readFileSync(paths.configPath, "utf8");
  const result = webConfigSchema.safeParse(deepStripTomlSymbols(parseToml(globalRaw)));
  if (!result.success) {
    throw new AppError(
      `Config file validation failed (${paths.configPath}).\n${formatZodErrors(result.error)}`,
      "CONFIG_SCHEMA_ERROR",
    );
  }
  return result.data as WebConfig;
}

export function saveConfig(config: WebConfig): void {
  const paths = ensureConfigDir();
  const parsed = webConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new AppError(
      `Failed to save config: validation error.\n${formatZodErrors(parsed.error)}`,
      "CONFIG_SAVE_SCHEMA_ERROR",
    );
  }
  const tmpPath = `${paths.configPath}.tmp`;
  fs.writeFileSync(tmpPath, stringifyToml(parsed.data as any), "utf8");
  fs.renameSync(tmpPath, paths.configPath);
}

/** 按 config.toml 中 `[group.account.*]` 的声明顺序依次尝试；失败则换下一个。 */
export function resolveGroupOrder(group: GroupConfig): string[] {
  return Object.keys(group.account);
}

export function getModel(group: GroupConfig, alias: string): ModelConfig {
  const model = group.account[alias];
  if (!model) {
    const available = Object.keys(group.account);
    throw new AppError(
      `Account id '${alias}' not found. Available: ${available.length ? available.join(", ") : "(none)"}`,
      "CONFIG_MODEL_NOT_FOUND",
    );
  }
  return model;
}

export function setModel(
  config: WebConfig,
  groupName: GroupName,
  alias: string,
  model: ModelConfig,
): WebConfig {
  const next = structuredClone(config);
  next[groupName].account[alias] = model;
  return next;
}

export function removeModel(config: WebConfig, groupName: GroupName, alias: string): WebConfig {
  const next = structuredClone(config);
  delete next[groupName].account[alias];
  return next;
}

function resolveConfigEnvTokens(config: WebConfig, mergedEnv: Record<string, string | undefined>): WebConfig {
  const next = structuredClone(config);
  const groups: GroupName[] = ["search", "fetch", "research", "answer"];
  for (const groupName of groups) {
    for (const [alias, model] of Object.entries(next[groupName].account)) {
      if (!model.api_token) continue;
      if (model.enabled === false) continue;
      const token = resolveEnvToken(model.api_token, mergedEnv);
      next[groupName].account[alias].api_token = token;
    }
  }
  return next;
}

function resolveEnvToken(rawValue: string, mergedEnv: Record<string, string | undefined>): string {
  const match = rawValue.match(/^\{\$([A-Z0-9_]+)\}$/);
  if (!match) return rawValue;
  const envName = match[1];
  const value = mergedEnv[envName];
  if (!value) {
    throw new AppError(
      `Environment variable '${envName}' is not set.\n` +
      `  Fix: add ${envName}=your_key to ~/.web/.env\n` +
      `  Or:  set the provider's enabled = false in ~/.web/config.toml to skip it.`,
      "ENV_TOKEN_NOT_FOUND",
    );
  }
  return value;
}

