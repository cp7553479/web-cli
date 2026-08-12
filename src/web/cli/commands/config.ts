import fs from "node:fs";
import { spawn } from "node:child_process";

import { Command } from "commander";

import { AppError, getAppPaths } from "../../../core";
import {
  APP_NAME,
  DEFAULT_CONFIG_JSON,
  DEFAULT_ENV_EXAMPLE,
  loadGlobalWebConfigRaw,
  loadWebConfig,
  maskToken,
  removeAccount,
  saveGlobalWebConfig,
  setAccount,
  writeActivePointer,
  type AccountConfig,
} from "../../config";
import { SEGMENTS, type SegmentName, type WebConfig } from "../../config/types";
import { materializeRegistries } from "../../config/materialize";
import { PluginHost } from "../../../core";
import { registerBuiltinFactories } from "../../providers";

export function registerConfigCommand(program: Command): void {
  const cmd = program.command("config").description("View and edit ~/.web/config.json");

  cmd
    .command("init")
    .description("Write the default config.json + .env (non-interactive); --force overwrites")
    .option("--force", "overwrite an existing config.json")
    .action((opts: { force?: boolean }) => {
      const paths = getAppPaths(APP_NAME);
      fs.mkdirSync(paths.globalRoot, { recursive: true });
      const created: string[] = [];
      const skipped: string[] = [];
      if (fs.existsSync(paths.globalConfig) && !opts.force) {
        skipped.push(paths.globalConfig);
      } else {
        fs.writeFileSync(paths.globalConfig, DEFAULT_CONFIG_JSON, "utf8");
        created.push(paths.globalConfig);
      }
      if (!fs.existsSync(paths.globalEnv)) {
        fs.writeFileSync(paths.globalEnv, DEFAULT_ENV_EXAMPLE, "utf8");
        created.push(paths.globalEnv);
      } else {
        skipped.push(paths.globalEnv);
      }
      process.stdout.write(`Created:\n${created.map((p) => `  ${p}`).join("\n") || "  (none)"}\n`);
      if (skipped.length) process.stdout.write(`Skipped:\n${skipped.map((p) => `  ${p}`).join("\n")}\n`);
      process.stdout.write(`\nNext: edit ${paths.globalConfig} or run 'web config set <group> <alias> --provider <p> --token <key>'.\n`);
    });

  cmd
    .command("path")
    .description("Print resolved config / current / logs paths")
    .action(() => {
      const paths = getAppPaths(APP_NAME);
      const projectRoot = paths.projectRoot ?? "(none)";
      process.stdout.write(
        [
          `globalRoot: ${paths.globalRoot}`,
          `globalConfig: ${paths.globalConfig}`,
          `globalCurrent: ${paths.globalCurrent}`,
          `globalEnv: ${paths.globalEnv}`,
          `projectRoot: ${projectRoot}`,
          `logsDir: ${paths.logsDir}`,
          "",
        ].join("\n"),
      );
    });

  cmd
    .command("show")
    .description("Print the resolved global config with masked keys")
    .option("--json", "emit raw JSON")
    .action((opts: { json?: boolean }) => {
      const { config } = loadGlobalWebConfigRaw();
      const masked = maskConfigTokens(config);
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(masked, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${JSON.stringify(masked, null, 2)}\n`);
    });

  cmd
    .command("list")
    .description("List configured accounts per group (keys masked)")
    .action(() => {
      const { config } = loadGlobalWebConfigRaw();
      const lines: string[] = [];
      for (const segment of SEGMENTS) {
        const accounts = config[segment]?.account ?? {};
        lines.push(`[${segment}]`);
        const entries = Object.entries(accounts);
        if (entries.length === 0) {
          lines.push("  (no accounts)");
        }
        for (const [alias, account] of entries) {
          lines.push(
            `  ${alias}  provider=${account.provider}  token=${maskToken(account.api_token) ?? "(none)"}  base_url=${account.base_url ?? "(default)"}  enabled=${account.enabled === false ? "false" : "true"}`,
          );
        }
      }
      process.stdout.write(`${lines.join("\n")}\n`);
    });

  cmd
    .command("set <group> <alias>")
    .description("Add or update an account entry")
    .requiredOption("--provider <provider>", "provider name (e.g. tavily)")
    .option("--token <token>", "api token (literal or {$ENV})")
    .option("--base-url <url>", "override default endpoint")
    .option("--enabled <bool>", "enable/disable", "true")
    .action((group: string, alias: string, opts: { provider: string; token?: string; baseUrl?: string; enabled: string }) => {
      const { config, paths } = loadGlobalWebConfigRaw();
      const account: AccountConfig = {
        provider: opts.provider,
        api_token: opts.token,
        base_url: opts.baseUrl,
        enabled: opts.enabled !== "false",
      };
      const next = setAccount(config, asSegment(group), alias, account);
      saveGlobalWebConfig(next, paths);
      process.stdout.write("ok\n");
    });

  cmd
    .command("remove <group> <alias>")
    .description("Remove an account entry")
    .action((group: string, alias: string) => {
      const { config, paths } = loadGlobalWebConfigRaw();
      const next = removeAccount(config, asSegment(group), alias);
      saveGlobalWebConfig(next, paths);
      process.stdout.write("ok\n");
    });

  cmd
    .command("use <group> <alias>")
    .description("Set the active default account for a group (writes current.json)")
    .action((group: string, alias: string) => {
      const segment = asSegment(group);
      const { config, paths } = loadGlobalWebConfigRaw();
      if (!config[segment]?.account?.[alias]) {
        throw new AppError(`Account '${alias}' not found in [${segment}].`, "ACCOUNT_NOT_FOUND");
      }
      writeActivePointer(paths, segment, alias);
      process.stdout.write(`ok (active ${segment} = ${alias})\n`);
    });

  cmd
    .command("doctor")
    .description("Self-check: config, curl, accounts, {$ENV} references")
    .option("--json", "emit raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const report = await runDoctor();
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }
      const lines: string[] = [];
      lines.push(`config: ${report.configOk ? "ok" : "FAIL " + report.configError}`);
      lines.push(`curl: ${report.curlAvailable ? "ok" : "missing"}`);
      for (const a of report.accounts) {
        const flag = a.factoryOk && a.envOk ? "ok" : "warn";
        lines.push(`  [${a.segment}.${a.alias}] provider=${a.provider} factory=${a.factoryOk ? "ok" : "MISSING"} env=${a.envOk ? "ok" : "UNRESOLVED"} ${flag === "warn" ? "(warn)" : ""}`);
      }
      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

function asSegment(group: string): SegmentName {
  if (!SEGMENTS.includes(group as SegmentName)) {
    throw new AppError(`Invalid group '${group}'. Must be one of: ${SEGMENTS.join(", ")}`, "INVALID_PARAM");
  }
  return group as SegmentName;
}

function maskConfigTokens(config: WebConfig): WebConfig {
  const clone = structuredClone(config);
  for (const segment of SEGMENTS) {
    for (const account of Object.values(clone[segment]?.account ?? {})) {
      if (account.api_token) account.api_token = maskToken(account.api_token);
    }
  }
  return clone;
}

interface DoctorReport {
  configOk: boolean;
  configError?: string;
  curlAvailable: boolean;
  accounts: Array<{ segment: string; alias: string; provider: string; factoryOk: boolean; envOk: boolean; envError?: string }>;
}

async function runDoctor(): Promise<DoctorReport> {
  const report: DoctorReport = { configOk: false, curlAvailable: false, accounts: [] };

  // Config + env resolution check (merged view).
  try {
    loadWebConfig();
    report.configOk = true;
  } catch (error) {
    report.configError = error instanceof Error ? error.message : String(error);
  }

  report.curlAvailable = await hasCurl();

  // Factory + env-token presence check (global raw view, no resolution).
  const { config } = loadGlobalWebConfigRaw();
  const host = new PluginHost();
  registerBuiltinFactories(host);
  const { skipped } = materializeRegistries(config, host);
  const skippedKey = new Set(skipped.map((s) => `${s.segment}:${s.alias}`));
  for (const segment of SEGMENTS) {
    for (const [alias, account] of Object.entries(config[segment]?.account ?? {})) {
      const factoryOk = !skippedKey.has(`${segment}:${alias}`);
      const envMatch = account.api_token?.match(/^\{\$([A-Z0-9_]+)\}$/);
      const envOk = !envMatch || Boolean(process.env[envMatch[1]]);
      report.accounts.push({
        segment,
        alias,
        provider: account.provider,
        factoryOk,
        envOk,
        envError: envMatch && !envOk ? `env '${envMatch[1]}' unset` : undefined,
      });
    }
  }
  return report;
}

function hasCurl(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("curl", ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
