import fs from "node:fs";

import { Command } from "commander";

import { AppError, getAppPaths, PluginHost, type ProviderConfigField } from "../../../core";
import {
  APP_NAME,
  DEFAULT_CONFIG_JSON,
  DEFAULT_ENV_EXAMPLE,
  installSkills,
  loadActiveConfigRaw,
  maskToken,
  removeAccount,
  saveActiveConfig,
  setAccount,
  writeActivePointer,
  type AccountConfig,
} from "../../config";
import { SEGMENTS, type SegmentName, type WebConfig } from "../../config/types";
import { findCatalogEntry } from "../../plugins/builtin/catalog";
import { loadPlugins } from "../../plugins";
import { collectFieldValues, interactiveIo, seededIo } from "../../config/provider-fields";

export function registerConfigCommand(program: Command): void {
  const cmd = program.command("config").description("View and edit ~/.web/config.json");

  cmd
    .command("init")
    .description("Write the default config.json + .env and install agent skills; --force overwrites")
    .option("--force", "overwrite an existing config.json and installed skill files")
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
      const skills = installSkills(opts.force);
      created.push(...skills.created);
      skipped.push(...skills.skipped);
      if (created.length) process.stdout.write(`Created:\n${created.map((p) => `  ${p}`).join("\n")}\n`);
      else process.stdout.write("Created:\n  (none)\n");
      if (skipped.length) process.stdout.write(`Skipped:\n${skipped.map((p) => `  ${p}`).join("\n")}\n`);
      process.stdout.write(`\nNext: edit ${paths.globalConfig} or run 'web config set <group> <alias> --provider <p> --token <key>'.\n`);
    });

  cmd
    .command("add <group> <alias>")
    .description("Add an account guided by the provider's config schema (menus in a TTY; --field pre-answers)")
    .requiredOption("--provider <idOrAlias>", "provider id or catalog alias")
    .option("--token <token>", "api token (literal or {$ENV})")
    .option("--field <key=value>", "pre-answer one schema field (repeatable)", (value: string, previous: string[] = []) => [...previous, value])
    .action(async (group: string, alias: string, opts: { provider: string; token?: string; field?: string[] }) => {
      const segment = asSegment(group);
      const { config, paths } = loadActiveConfigRaw();

      const host = new PluginHost();
      loadPlugins(host);
      const providerId = findCatalogEntry(opts.provider)?.providerId ?? opts.provider;
      const factory = host.getFactory(providerId);
      if (!factory) {
        throw new AppError(`Unknown provider '${opts.provider}'. Available: ${host.listFactories().join(", ")}`, "PROVIDER_NOT_FOUND");
      }
      if (!factory.capabilities.includes(segment)) {
        throw new AppError(`Provider '${providerId}' does not support '${segment}' (capabilities: ${factory.capabilities.join(", ")}).`, "CAPABILITY_UNSUPPORTED");
      }

      const seed: Record<string, string> = {};
      for (const pair of opts.field ?? []) {
        const eq = pair.indexOf("=");
        if (eq <= 0) {
          throw new AppError(`--field expects key=value, got '${pair}'.`, "INVALID_PARAM");
        }
        seed[pair.slice(0, eq)] = pair.slice(eq + 1);
      }

      const fields = factory.config ?? fallbackFields(providerId);
      const interactive = Boolean(process.stdin.isTTY);
      const handle = interactive ? interactiveIo() : undefined;
      const io = handle?.io ?? seededIo(seed);
      let values: Record<string, string>;
      try {
        values = await collectFieldValues(fields, io);
      } finally {
        handle?.close();
      }

      const account: AccountConfig = { provider: providerId };
      if (opts.token) account.api_token = opts.token;
      Object.assign(account, values);
      const next = setAccount(config, segment, alias, account);
      saveActiveConfig(next, paths);

      const written = Object.entries(account)
        .filter(([key]) => key !== "provider")
        .map(([key, value]) => `  ${key} = ${key === "api_token" ? maskToken(String(value)) : value}`);
      process.stdout.write(`added [${segment}.account.${alias}] provider=${providerId}\n`);
      if (written.length) process.stdout.write(`${written.join("\n")}\n`);
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
      const { config } = loadActiveConfigRaw();
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
      const { config } = loadActiveConfigRaw();
      const lines: string[] = [];
      for (const segment of SEGMENTS) {
        const accounts = config[segment]?.account ?? {};
        lines.push(`[${segment}]`);
        const providers = config[segment]?.providers;
        if (providers?.primary || providers?.list?.length) {
          const parts: string[] = [];
          if (providers.primary) parts.push(`primary=${providers.primary}`);
          if (providers.list?.length) parts.push(`list=[${providers.list.join(",")}]`);
          lines.push(`  ${parts.join("  ")}`);
        }
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
      const { config, paths } = loadActiveConfigRaw();
      const account: AccountConfig = {
        provider: opts.provider,
        api_token: opts.token,
        base_url: opts.baseUrl,
        enabled: opts.enabled !== "false",
      };
      const next = setAccount(config, asSegment(group), alias, account);
      saveActiveConfig(next, paths);
      process.stdout.write("ok\n");
    });

  cmd
    .command("remove <group> <alias>")
    .description("Remove an account entry")
    .action((group: string, alias: string) => {
      const { config, paths } = loadActiveConfigRaw();
      const next = removeAccount(config, asSegment(group), alias);
      saveActiveConfig(next, paths);
      process.stdout.write("ok\n");
    });

  cmd
    .command("use <group> <alias>")
    .description("Set the active default account for a group (writes current.json)")
    .action((group: string, alias: string) => {
      const segment = asSegment(group);
      const { config, paths } = loadActiveConfigRaw();
      if (!config[segment]?.account?.[alias]) {
        throw new AppError(`Account '${alias}' not found in [${segment}].`, "ACCOUNT_NOT_FOUND");
      }
      writeActivePointer(paths, segment, alias);
      process.stdout.write(`ok (active ${segment} = ${alias})\n`);
    });
}

function asSegment(group: string): SegmentName {
  if (!SEGMENTS.includes(group as SegmentName)) {
    throw new AppError(`Invalid group '${group}'. Must be one of: ${SEGMENTS.join(", ")}`, "INVALID_PARAM");
  }
  return group as SegmentName;
}

/** Fields offered when a provider declares no schema: its base URL (if any). */
function fallbackFields(providerId: string): ProviderConfigField[] {
  const entry = findCatalogEntry(providerId);
  if (!entry?.defaultBaseUrl) return [];
  return [{ key: "base_url", label: `Base URL (default ${entry.defaultBaseUrl})` }];
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
