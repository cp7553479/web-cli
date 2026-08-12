import { Command } from "commander";

import { PROVIDER_CATALOG, PROVIDER_MODELS, findCatalogEntry } from "../../providers/catalog";
import { loadExternalPlugins, getUserPluginsRoot } from "../../plugins/external";
import { PluginHost } from "../../../core";
import { registerBuiltinFactories } from "../../providers";

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
        lines.push(`${e.providerId}  [${e.capabilities.join(",")}]  ${e.defaultBaseUrl || "(none)"}${alias}`);
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
  const host = new PluginHost();
  registerBuiltinFactories(host);
  loadExternalPlugins(host);
  const known = new Set(PROVIDER_CATALOG.map((e) => e.providerId));
  const plugins = host
    .listFactories()
    .filter((name) => !known.has(name))
    .map((name) => ({ providerId: name, aliases: [] as string[], capabilities: [] as string[], defaultBaseUrl: "plugin-defined", description: "Local plugin provider" }));
  return [...builtIn, ...plugins];
}
