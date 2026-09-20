import { Command } from "commander";

import { loadActiveConfigRaw } from "../../config";
import { PROVIDER_CATALOG, PROVIDER_MODELS, findCatalogEntry } from "../../plugins/builtin/catalog";
import { loadPlugins, getUserPluginsRoot } from "../../plugins";
import { PluginHost } from "../../../core";

export function registerProviderCommand(program: Command): void {
  const cmd = program.command("provider").description("Inspect built-in and plugin providers");

  cmd
    .command("list")
    .description("List provider ids, aliases, capabilities, and base URL")
    .option("--json", "emit raw JSON")
    .action((opts: { json?: boolean }) => {
      const entries = collectProviderEntries();
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
        return;
      }
      const lines: string[] = [];
      for (const e of entries) {
        const alias = e.aliases.length ? `  aliases=${e.aliases.join(",")}` : "";
        const enabled = e.enabled ? "" : "  enabled=false";
        lines.push(`${e.providerId}  [${e.capabilities.join(",")}]  ${e.defaultBaseUrl || "(none)"}${alias}${enabled}`);
      }
      process.stdout.write(`${lines.join("\n")}\n`);
    });

  cmd
    .command("models <provider-id>")
    .description("List known models for a provider (built-in list; no live discovery)")
    .option("--json", "emit raw JSON")
    .action((providerId: string, opts: { json?: boolean }) => {
      const entry = findCatalogEntry(providerId);
      const models = PROVIDER_MODELS[entry?.providerId ?? providerId] ?? [];
      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ providerId: entry?.providerId ?? providerId, models }, null, 2)}\n`);
        return;
      }
      if (models.length === 0) {
        process.stdout.write(`${providerId}: (no built-in model list; models are provider-driven)\n`);
        return;
      }
      process.stdout.write(`${providerId}:\n${models.map((m) => `  - ${m}`).join("\n")}\n`);
    });

  cmd.addHelpText(
    "after",
    `\nPlugins are discovered under ${getUserPluginsRoot()}/<id>/plugin.json.`,
  );
}

function collectProviderEntries() {
  const builtIn = PROVIDER_CATALOG.map((e) => ({
    providerId: e.providerId,
    aliases: [...e.aliases],
    capabilities: [...e.capabilities],
    defaultBaseUrl: e.defaultBaseUrl,
    description: e.description,
  }));
  // Surface plugin-registered factory names not already in the catalog.
  const host: PluginHost = new PluginHost();
  loadPlugins(host);
  const { config } = loadActiveConfigRaw();
  const known = new Set(PROVIDER_CATALOG.map((e) => e.providerId));
  const plugins = host
    .listFactories()
    .filter((name) => !known.has(name))
    .map((name) => ({ providerId: name, aliases: [] as string[], capabilities: [] as string[], defaultBaseUrl: "plugin-defined", description: "Local plugin provider" }));
  const isEnabled = (providerId: string) => config.providers?.[providerId]?.enabled !== false;
  return [...builtIn, ...plugins].map((e) => ({ ...e, enabled: isEnabled(e.providerId) }));
}
