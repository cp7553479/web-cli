import { AppError } from "../../core/errors";
import type { ConfigValidator } from "../../core/config/validator";
import {
  SEGMENTS,
  type AccountConfig,
  type ProviderConfig,
  type RuntimeConfig,
  type SegmentConfig,
  type SegmentProviders,
  type WebConfig,
} from "./types";

/**
 * Hand-written structural validator (no schema library). Checks the merged raw
 * config for shape errors with concise, path-aware messages. Provider-name
 * existence is NOT checked here — that happens at materialize time so unknown
 * providers can be reported by `web doctor` rather than blocking load.
 */
export const webConfigValidator: ConfigValidator<WebConfig> = {
  validate(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new AppError("Config root must be an object.", "CONFIG_SCHEMA_ERROR");
    }
    const root = raw as Record<string, unknown>;
    const out: WebConfig = {
      runtime: validateRuntime(root.runtime),
      providers: validateProviders(root.providers),
      search: validateSegment(root.search, "search"),
      fetch: validateSegment(root.fetch, "fetch"),
    };
    if (root.images !== undefined && root.images !== null) {
      out.images = validateSegment(root.images, "images");
    }
    if (root.ask !== undefined && root.ask !== null) {
      out.ask = validateSegment(root.ask, "ask");
    }
    return out;
  },
};

function validateProviders(value: unknown): Record<string, ProviderConfig> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) {
    throw new AppError("providers must be an object.", "CONFIG_SCHEMA_ERROR");
  }
  const out: Record<string, ProviderConfig> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!name) {
      throw new AppError("providers has an empty provider name.", "CONFIG_SCHEMA_ERROR");
    }
    if (!isObject(entry)) {
      throw new AppError(`[providers.${name}] must be an object.`, "CONFIG_SCHEMA_ERROR");
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
      throw new AppError(`[providers.${name}].enabled must be a boolean.`, "CONFIG_SCHEMA_ERROR");
    }
    out[name] = { enabled: entry.enabled as boolean | undefined };
  }
  return out;
}

function validateRuntime(value: unknown): RuntimeConfig | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) {
    throw new AppError("runtime must be an object.", "CONFIG_SCHEMA_ERROR");
  }
  const runtime = value as Record<string, unknown>;
  const out: RuntimeConfig = {};
  if (runtime.logging !== undefined) {
    if (typeof runtime.logging !== "boolean") {
      throw new AppError("runtime.logging must be a boolean.", "CONFIG_SCHEMA_ERROR");
    }
    out.logging = runtime.logging;
  }
  if (runtime.lock_ttl_ms !== undefined) {
    if (typeof runtime.lock_ttl_ms !== "number" || !Number.isInteger(runtime.lock_ttl_ms) || runtime.lock_ttl_ms <= 0) {
      throw new AppError("runtime.lock_ttl_ms must be a positive integer (ms).", "CONFIG_SCHEMA_ERROR");
    }
    out.lock_ttl_ms = runtime.lock_ttl_ms;
  }
  if (runtime.retry_rounds !== undefined) {
    if (typeof runtime.retry_rounds !== "number" || !Number.isInteger(runtime.retry_rounds) || runtime.retry_rounds <= 0) {
      throw new AppError("runtime.retry_rounds must be a positive integer.", "CONFIG_SCHEMA_ERROR");
    }
    out.retry_rounds = runtime.retry_rounds;
  }
  return out;
}

function validateSegment(value: unknown, segment: string): SegmentConfig {
  if (value === undefined || value === null) {
    return { account: {} };
  }
  if (!isObject(value)) {
    throw new AppError(`[${segment}] must be an object.`, "CONFIG_SCHEMA_ERROR");
  }
  const seg = value as Record<string, unknown>;
  if (seg.inject_before !== undefined && typeof seg.inject_before !== "string") {
    throw new AppError(`[${segment}].inject_before must be a string.`, "CONFIG_SCHEMA_ERROR");
  }
  if (seg.inject_after !== undefined && typeof seg.inject_after !== "string") {
    throw new AppError(`[${segment}].inject_after must be a string.`, "CONFIG_SCHEMA_ERROR");
  }
  return {
    inject_before: seg.inject_before as string | undefined,
    inject_after: seg.inject_after as string | undefined,
    providers: validateSegmentProviders(seg.providers, segment),
    account: validateAccounts(seg.account, segment),
  };
}

function validateSegmentProviders(value: unknown, segment: string): SegmentProviders | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) {
    throw new AppError(`[${segment}].providers must be an object.`, "CONFIG_SCHEMA_ERROR");
  }
  const out: SegmentProviders = {};
  if (value.primary !== undefined) {
    if (typeof value.primary !== "string" || !value.primary) {
      throw new AppError(`[${segment}].providers.primary must be a non-empty provider id.`, "CONFIG_SCHEMA_ERROR");
    }
    out.primary = value.primary;
  }
  if (value.list !== undefined) {
    if (!Array.isArray(value.list) || value.list.some((id) => typeof id !== "string" || !id)) {
      throw new AppError(`[${segment}].providers.list must be an array of provider ids.`, "CONFIG_SCHEMA_ERROR");
    }
    out.list = value.list;
  }
  return out;
}

function validateAccounts(value: unknown, segment: string): Record<string, AccountConfig> {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) {
    throw new AppError(`[${segment}].account must be an object.`, "CONFIG_SCHEMA_ERROR");
  }
  const accounts = value as Record<string, unknown>;
  const out: Record<string, AccountConfig> = {};
  for (const [alias, entry] of Object.entries(accounts)) {
    if (!alias) {
      throw new AppError(`[${segment}].account has an empty alias.`, "CONFIG_SCHEMA_ERROR");
    }
    out[alias] = validateAccount(entry, segment, alias);
  }
  return out;
}

function validateAccount(value: unknown, segment: string, alias: string): AccountConfig {
  if (!isObject(value)) {
    throw new AppError(`[${segment}.account.${alias}] must be an object.`, "CONFIG_SCHEMA_ERROR");
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.provider !== "string" || !entry.provider) {
    throw new AppError(`[${segment}.account.${alias}].provider is required and must be a non-empty string.`, "CONFIG_SCHEMA_ERROR");
  }
  if (entry.api_token !== undefined && typeof entry.api_token !== "string") {
    throw new AppError(`[${segment}.account.${alias}].api_token must be a string.`, "CONFIG_SCHEMA_ERROR");
  }
  if (entry.base_url !== undefined && typeof entry.base_url !== "string") {
    throw new AppError(`[${segment}.account.${alias}].base_url must be a string.`, "CONFIG_SCHEMA_ERROR");
  }
  if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
    throw new AppError(`[${segment}.account.${alias}].enabled must be a boolean.`, "CONFIG_SCHEMA_ERROR");
  }
  const out: AccountConfig = {
    provider: entry.provider,
    api_token: entry.api_token as string | undefined,
    base_url: entry.base_url as string | undefined,
    enabled: entry.enabled as boolean | undefined,
  };
  // Provider schema fields pass through verbatim (flat string values) — they
  // are handed to the factory binding at materialize time.
  for (const [key, field] of Object.entries(entry)) {
    if (key in out) continue;
    if (typeof field === "string") out[key] = field;
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Re-exported for the doctor/materialize layers. */
export { SEGMENTS };
