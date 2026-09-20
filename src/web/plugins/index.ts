import type { PluginHost } from "../../core";
import { BUILTIN_PLUGINS } from "./builtin";
import { loadExternalPlugins } from "./external";

export { BUILTIN_PLUGINS, PROVIDER_CATALOG, PROVIDER_MODELS, findCatalogEntry } from "./builtin";
export type { ProviderCatalogEntry } from "./builtin";
export { loadExternalPlugins, getUserPluginsRoot, getProjectPluginsRoot } from "./external";
export type { WebPluginManifest } from "./external";
export type { WebPlugin } from "./types";

/**
 * Single entry point the CLI uses to populate a {@link PluginHost}: every
 * provider — built-in or external — arrives as a plugin through this path.
 * Order: built-in plugins first, then user `~/.web/plugins`, then project
 * `./.web/plugins`; later registrations override same-named factories.
 */
export function loadPlugins(host: PluginHost, cwd: string = process.cwd()): void {
  for (const plugin of BUILTIN_PLUGINS) plugin.activate(host);
  loadExternalPlugins(host, cwd);
}
