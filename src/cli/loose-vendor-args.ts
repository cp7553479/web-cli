import type { Command } from "commander";

function kebabToSnake(flag: string): string {
  return flag.replace(/-/g, "_");
}

function coerceValue(raw: string): unknown {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return raw;
}

/**
 * 解析 `command.args`：跳过前导位置参数，再读 `--foo` / `--foo=bar` / `--foo bar`。
 * 需在对应 command 上启用 `.allowUnknownOption(true).allowExcessArguments(true)`。
 * 键名：`--include-answer` → `include_answer`（与多数厂商 JSON 字段一致）。
 * 与 `--vendor` 合并时建议后者覆盖同名键（调用方 `{ ...parseTrailingLooseVendorArgs(command.args), ...parseVendorPairs(vendor) }`）。
 */
export function parseTrailingLooseVendorArgs(args: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < args.length && !String(args[i]).startsWith("--")) {
    i += 1;
  }
  while (i < args.length) {
    const token = String(args[i]);
    if (!token.startsWith("--")) {
      i += 1;
      continue;
    }
    if (token.includes("=")) {
      const eq = token.indexOf("=");
      const rawKey = token.slice(2, eq);
      const val = token.slice(eq + 1);
      if (rawKey) out[kebabToSnake(rawKey)] = coerceValue(val);
      i += 1;
      continue;
    }
    const rawKey = token.slice(2);
    const key = kebabToSnake(rawKey);
    const next = i + 1 < args.length ? String(args[i + 1]) : null;
    if (next && !next.startsWith("--")) {
      out[key] = coerceValue(next);
      i += 2;
    } else {
      out[key] = true;
      i += 1;
    }
  }
  return out;
}

export function parseTrailingLooseVendor(command: Command): Record<string, unknown> {
  return parseTrailingLooseVendorArgs(command.args);
}
