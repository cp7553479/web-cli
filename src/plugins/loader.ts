import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { getConfigPaths } from "../config";
import { errorLog } from "../core/logger";
import type { WebPlugin } from "./protocol";
import type { PluginHost } from "./host";

const nodeRequire = createRequire(path.join(__dirname, "host.js"));

export interface WebPluginManifest {
  id: string;
  main: string;
  version?: string;
}

export function getUserPluginsRoot(): string {
  return path.join(getConfigPaths().rootDir, "plugins");
}

export function getProjectPluginsRoot(cwd = process.cwd()): string {
  return path.join(cwd, ".web", "plugins");
}

/**
 * 扫描 root/plugins 子目录下的 web-plugin.json，加载 main 指向的 CommonJS 模块。
 * 模块须 `export default` 或 `exports.default` / `exports.webPlugin` 为 WebPlugin。
 */
function loadPluginsAtRoot(host: PluginHost, root: string): void {
  if (!fs.existsSync(root)) return;

  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const pluginDir = path.join(root, ent.name);
    const manifestPath = path.join(pluginDir, "web-plugin.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }
    let manifest: WebPluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as WebPluginManifest;
    } catch (error) {
      errorLog(`plugin.loader.manifest_parse:${pluginDir}`, error);
      continue;
    }
    if (!manifest.id || !manifest.main) {
      errorLog(`plugin.loader.manifest_invalid:${manifestPath}`, new Error("missing id or main"));
      continue;
    }
    const entryPath = path.resolve(pluginDir, manifest.main);
    const pluginRealDir = path.resolve(pluginDir);
    if (!entryPath.startsWith(pluginRealDir + path.sep) && entryPath !== pluginRealDir) {
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
    const raw = (mod.default ?? mod.webPlugin) as WebPlugin | undefined;
    if (!raw || typeof raw.activate !== "function") {
      errorLog(`plugin.loader.invalid_export:${entryPath}`, new Error("expected WebPlugin with activate()"));
      continue;
    }
    try {
      raw.activate(host);
    } catch (error) {
      errorLog(`plugin.loader.activate_failed:${manifest.id}`, error);
    }
  }
}

/** 先 ~/.web/plugins，再 cwd/.web/plugins（后者覆盖同名 provider 工厂注册）。 */
export function loadExternalPlugins(host: PluginHost, cwd = process.cwd()): void {
  loadPluginsAtRoot(host, getUserPluginsRoot());
  const proj = getProjectPluginsRoot(cwd);
  if (path.resolve(proj) !== path.resolve(getUserPluginsRoot())) {
    loadPluginsAtRoot(host, proj);
  }
}
