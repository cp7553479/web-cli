import fs from "node:fs";
import { spawn } from "node:child_process";

import { Command } from "commander";

import { AppError, getAppPaths, loadAppEnv, PluginHost } from "../../../core";
import {
  APP_NAME,
  DEFAULT_CONFIG_JSON,
  DEFAULT_ENV_EXAMPLE,
  loadActiveConfigRaw,
  loadWebConfig,
} from "../../config";
import { SEGMENTS } from "../../config/types";
import { materializeRegistries } from "../../config/materialize";
import { loadPlugins } from "../../plugins";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Self-check: config, curl, accounts, {$ENV} references; --fix repairs what is safe")
    .option("--json", "emit raw JSON")
    .option("--fix", "create missing config.json/.env, reset a corrupt current.json")
    .action(async (opts: { json?: boolean; fix?: boolean }) => {
      const report = await runDoctor(Boolean(opts.fix));
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(`${renderDoctor(report)}\n`);
      }
      const hardFail =
        !report.configOk || !report.curlAvailable || report.accounts.some((a) => !a.factoryOk);
      if (hardFail) process.exitCode = 1;
    });
}

interface DoctorReport {
  configOk: boolean;
  configError?: string;
  curlAvailable: boolean;
  fixed: string[];
  order: Array<{ segment: string; primary?: string; list: string[]; unknown: string[] }>;
  accounts: Array<{ segment: string; alias: string; provider: string; providerEnabled: boolean; factoryOk: boolean; envOk: boolean; envError?: string }>;
}

async function runDoctor(fix: boolean): Promise<DoctorReport> {
  const report: DoctorReport = { configOk: false, curlAvailable: false, fixed: [], order: [], accounts: [] };

  if (fix) applyFixes(report);

  // Config + env resolution check (merged view).
  try {
    loadWebConfig();
    report.configOk = true;
  } catch (error) {
    report.configError = error instanceof Error ? error.message : String(error);
  }

  report.curlAvailable = await hasCurl();

  // Factory + env-token presence check (global raw view, no resolution).
  // env check uses the same layered sources as runtime resolution
  // (process.env ← ~/.web/.env ← project .env), not bare process.env.
  const { config, paths } = loadActiveConfigRaw();
  const layeredEnv = loadAppEnv(paths);
  const host = new PluginHost();
  loadPlugins(host);
  const { skipped } = materializeRegistries(config, host);
  for (const segment of SEGMENTS) {
    const providers = config[segment]?.providers;
    if (!providers?.primary && !providers?.list?.length) continue;
    const ids = [...new Set([providers.primary, ...(providers.list ?? [])].filter((x): x is string => Boolean(x)))];
    report.order.push({
      segment,
      primary: providers.primary,
      list: providers.list ?? [],
      unknown: ids.filter((id) => !host.hasFactory(id)),
    });
  }
  // A missing/unsupported factory is a broken account (hard); "disabled" and
  // "provider-disabled" are intentional config and only downgrade to warn.
  const broken = new Set(
    skipped
      .filter((s) => s.reason === "no-factory" || s.reason === "capability-unsupported")
      .map((s) => `${s.segment}:${s.alias}`),
  );
  for (const segment of SEGMENTS) {
    for (const [alias, account] of Object.entries(config[segment]?.account ?? {})) {
      const factoryOk = !broken.has(`${segment}:${alias}`);
    const envMatch = account.api_token?.match(/^\{\$([A-Z0-9_]+)\}$/);
    const envOk = !envMatch || Boolean(layeredEnv[envMatch[1]]);
    report.accounts.push({
      segment,
      alias,
      provider: account.provider,
      providerEnabled: config.providers?.[account.provider]?.enabled !== false,
      factoryOk,
      envOk,
      envError: envMatch && !envOk ? `env '${envMatch[1]}' unset` : undefined,
    });
    }
  }
  return report;
}

/** Only repairs what can be recreated without data loss; everything else is report-only. */
function applyFixes(report: DoctorReport): void {
  const paths = getAppPaths(APP_NAME);
  fs.mkdirSync(paths.globalRoot, { recursive: true });
  if (!fs.existsSync(paths.globalConfig)) {
    fs.writeFileSync(paths.globalConfig, DEFAULT_CONFIG_JSON, "utf8");
    report.fixed.push(`created ${paths.globalConfig}`);
  }
  if (!fs.existsSync(paths.globalEnv)) {
    fs.writeFileSync(paths.globalEnv, DEFAULT_ENV_EXAMPLE, "utf8");
    report.fixed.push(`created ${paths.globalEnv}`);
  }
  if (fs.existsSync(paths.globalCurrent)) {
    try {
      JSON.parse(fs.readFileSync(paths.globalCurrent, "utf8"));
    } catch {
      fs.writeFileSync(paths.globalCurrent, "{}\n", "utf8");
      report.fixed.push(`reset corrupt ${paths.globalCurrent}`);
    }
  }
}

function renderDoctor(report: DoctorReport): string {
  const lines: string[] = [];
  for (const f of report.fixed) lines.push(`fixed: ${f}`);
  lines.push(`config: ${report.configOk ? "ok" : "FAIL " + report.configError}`);
  lines.push(`curl: ${report.curlAvailable ? "ok" : "missing"}`);
  for (const o of report.order) {
    const parts: string[] = [];
    if (o.primary) parts.push(`primary=${o.primary}`);
    if (o.list.length) parts.push(`list=[${o.list.join(",")}]`);
    const warn = o.unknown.length ? ` (warn: unknown provider '${o.unknown.join("', '")}');` : "";
    lines.push(`${o.segment} order: ${parts.join("  ")}${warn}`);
  }
  for (const a of report.accounts) {
    const flag = a.factoryOk && a.envOk && a.providerEnabled ? "ok" : "warn";
    const disabled = a.providerEnabled ? "" : " enabled=false";
    lines.push(`  [${a.segment}.${a.alias}] provider=${a.provider}${disabled} factory=${a.factoryOk ? "ok" : "MISSING"} env=${a.envOk ? "ok" : "UNRESOLVED"} ${flag === "warn" ? "(warn)" : ""}`);
  }
  return lines.join("\n");
}

function hasCurl(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("curl", ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
