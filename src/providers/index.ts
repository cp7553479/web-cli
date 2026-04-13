import type { WebConfig } from "../config/types";
import { registerBuiltinFactories } from "../plugins/builtin";
import { PluginHost } from "../plugins/host";
import { loadExternalPlugins } from "../plugins/loader";
import { InMemoryProviderRegistry } from "./registry";

export function createRegistry(
  config: WebConfig,
  options?: { cwd?: string },
): InMemoryProviderRegistry {
  const cwd = options?.cwd ?? process.cwd();
  const host = new PluginHost();
  registerBuiltinFactories(host);
  loadExternalPlugins(host, cwd);
  return host.materialize(config);
}
