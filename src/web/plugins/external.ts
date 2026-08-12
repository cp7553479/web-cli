import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { errorLog, type PluginHost } from "../../core";

const nodeRequire = createRequire(path.join(__dirname, "external.js"));

export interface WebPluginManifest {
  id: string;
  main: string;
  version?: string;
}

export interface WebPlugin {
  id: string;
  version?: string;
  activate(host: PluginHost): void;
}

export function getUserPluginsRoot(): string {
  return path.join(os.homedir(), ".web", "plugins");
}

export function getProjectPluginsRoot(cwd: string = process.cwd()): string {
  return path.join(cwd, ".web", "plugins");
}

/**
 * Loads external plugins (user `~/.web/plugins` then project `./.web/plugins`).
 * Each plugin dir must contain a `plugin.json` ({ id, main }); `main` is a
 * CommonJS module whose default export (or `webPlugin` field) is a
 * {@link WebPlugin} whose `activate(host)` registers provider factories.
 *
 * Project plugins load after user plugins and may override same-named factories.
 * Plugins run IN-PROCESS with full privileges — install only trusted plugins.
 */
export function loadExternalPlugins(host: PluginHost, cwd: string = process.cwd()): void {
  loadAtRoot(host, getUserPluginsRoot());
  const project = getProjectPluginsRoot(cwd);
  if (path.resolve(project) !== path.resolve(getUserPluginsRoot())) {
    loadAtRoot(host, project);
  }
}

function loadAtRoot(host: PluginHost, root: string): void {
  if (!fs.existsSync(root)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    errorLog("plugin.loader.readdir", error);
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifestPath = path.join(dir, "plugin.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest: WebPluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as WebPluginManifest;
    } catch (error) {
      errorLog(`plugin.loader.manifest_parse:${manifestPath}`, error);
      continue;
    }
    if (!manifest.id || !manifest.main) {
      errorLog(`plugin.loader.manifest_invalid:${manifestPath}`, new Error("missing id or main"));
      continue;
    }
    const entryPath = path.resolve(dir, manifest.main);
    const realDir = path.resolve(dir);
    if (!entryPath.startsWith(realDir + path.sep) && entryPath !== realDir) {
      errorLog(`plugin.loader.unsafe_path:${entryPath}`, new Error("main escapes plugin dir"));
      continue;
    }
    if (!fs.existsSync(entryPath)) {
      errorLog(`plugin.loader.missing_entry:${entryPath}`, new Error("entry not found"));
      continue;
    }
    let mod: Record<string, unknown>;
    try {
      mod = nodeRequire(entryPath) as Record<string, unknown>;
    } catch (error) {
      errorLog(`plugin.loader.require_failed:${entryPath}`, error);
      continue;
    }
    const plugin = (mod.default ?? mod.webPlugin) as WebPlugin | undefined;
    if (!plugin || typeof plugin.activate !== "function") {
      errorLog(`plugin.loader.invalid_export:${entryPath}`, new Error("expected WebPlugin with activate()"));
      continue;
    }
    try {
      plugin.activate(host);
    } catch (error) {
      errorLog(`plugin.loader.activate_failed:${manifest.id}`, error);
    }
  }
}
