import { AppError } from "../../core/errors";

/**
 * Parses an array of `"key=value"` strings into a record. Values may contain
 * `=` (only the first `=` splits). Invalid entries throw a concise error.
 */
export function parseVendorPairs(pairs: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!pairs || pairs.length === 0) return out;
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new AppError(`Invalid --vendor value '${pair}'. Expected key=value.`, "INVALID_PARAM");
    }
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    if (!key) {
      throw new AppError(`Invalid --vendor value '${pair}'. Expected key=value.`, "INVALID_PARAM");
    }
    out[key] = coerce(value);
  }
  return out;
}

/**
 * Extracts loose `--key value` / `--key=value` pairs from a raw token list,
 * ignoring tokens whose long flag name is in `knownLongFlags` and any remaining
 * positionals. Used to support ergonomic `web search "q" --include_answer=true`
 * without forcing `--vendor`.
 */
export function parseLooseVendor(tokens: string[], knownLongFlags: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    const isEqForm = eq > 2;
    const name = isEqForm ? token.slice(2, eq) : token.slice(2);
    if (!name || knownLongFlags.has(name)) continue;
    if (isEqForm) {
      out[name] = coerce(token.slice(eq + 1));
      continue;
    }
    // `--key value` form: consume next token unless it's another flag or absent.
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[name] = coerce(next);
      i += 1;
    } else {
      out[name] = true;
    }
  }
  return out;
}

/**
 * Keeps only allowlisted keys from a vendor-params record. Provider-specific
 * options outside the OpenAI/web-common surface must be explicitly opted-in per
 * provider; unknown keys are silently dropped (never sent to the API).
 */
export function filterVendorParams(
  params: Record<string, unknown> | undefined,
  allowlist: ReadonlyArray<string>,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const allow = new Set(allowlist);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (allow.has(key)) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}
