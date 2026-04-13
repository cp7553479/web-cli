import fs from "node:fs";
import path from "node:path";

import { Command } from "commander";

import { getUserPluginsRoot } from "../../plugins/loader";
import type { WebPluginManifest } from "../../plugins/loader";

export function registerPluginsCommand(program: Command): void {
  const cmd = program.command("plugins").description("列出 ~/.web/plugins 下的外部插件");

  cmd
    .command("list")
    .description("扫描 web-plugin.json 并打印插件 id")
    .action(() => {
      const root = getUserPluginsRoot();
      if (!fs.existsSync(root)) {
        process.stdout.write(`(empty) ${root}\n`);
        return;
      }
      const entries = fs.readdirSync(root, { withFileTypes: true });
      let found = false;
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const manifestPath = path.join(root, ent.name, "web-plugin.json");
        if (!fs.existsSync(manifestPath)) continue;
        found = true;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as WebPluginManifest;
        process.stdout.write(`${manifest.id}\t${ent.name}\t${manifest.main ?? ""}\n`);
      }
      if (!found) process.stdout.write(`(no manifests) ${root}\n`);
    });

  cmd.addHelpText(
    "after",
    `
目录: ${getUserPluginsRoot()}
每个插件一个子目录，内含 web-plugin.json，例如:
  { "id": "acme-search", "main": "index.cjs" }
`,
  );
}
