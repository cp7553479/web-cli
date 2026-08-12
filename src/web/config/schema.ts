import { AppError } from "../../core/errors";
import type { ConfigValidator } from "../../core/config/validator";
import { SEGMENTS, type AccountConfig, type SegmentConfig, type WebConfig } from "./types";

/**
 * Hand-written structural validator (no schema library). Checks the merged raw
 * config for shape errors with concise, path-aware messages. Provider-name
 * existence is NOT checked here — that happens at materialize time so unknown
 * providers can be reported by `web config doctor` rather than blocking load.
 */
export const webConfigValidator: ConfigValidator<WebConfig> = {
  validate(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new AppError("Config root must be an object.", "CONFIG_SCHEMA_ERROR");
    }
    const root = raw as Record<string, unknown>;
    const out: WebConfig = {
      runtime: validateRuntime(root.runtime),
      search: validateSegment(root.search, "search"),
      fetch: validateSegment(root.fetch, "fetch"),
    };
    return out;
  },
};

function validateRuntime(value: unknown): { logging?: boolean } | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) {
    throw new AppError("runtime must be an object.", "CONFIG_SCHEMA_ERROR");
  }
  const runtime = value as Record<string, unknown>;
  const out: { logging?: boolean } = {};
  if (runtime.logging !== undefined) {
    if (typeof runtime.logging !== "boolean") {
      throw new AppError("runtime.logging must be a boolean.", "CONFIG_SCHEMA_ERROR");
    }
    out.logging = runtime.logging;
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
    account: validateAccounts(seg.account, segment),
  };
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
  return {
    provider: entry.provider,
    api_token: entry.api_token as string | undefined,
    base_url: entry.base_url as string | undefined,
    enabled: entry.enabled as boolean | undefined,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Re-exported for the doctor/materialize layers. */
export { SEGMENTS };
