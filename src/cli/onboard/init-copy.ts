import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { ensureConfigDir } from "../../config";
import { getUserPluginsRoot } from "../../plugins/loader";
import { resolvePackageInitDir } from "./init-paths";
import { defaultWebHomeReadme, defaultWebHomeReadmeCn } from "./readme-template";
import { syncAgentSkillsFromPackage } from "./sync-skills";

export { resolvePackageInitDir } from "./init-paths";

function formatEnvValue(v: string): string {
  if (/^[\w.:/+@-]+$/.test(v)) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

/** 将上一版 .env 中非空键写回模板（保留模板注释与键顺序；追加模板中未出现的旧键）。 */
function mergePreviousEnvIntoTemplate(templateContent: string, previousParsed: Record<string, string>): string {
  const lines = templateContent.split(/\r?\n/);
  const out: string[] = [];
  const seenKeys = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      seenKeys.add(key);
      const override = previousParsed[key];
      if (override) {
        out.push(`${key}=${formatEnvValue(override)}`);
        continue;
      }
    }
    out.push(line);
  }
  for (const [k, v] of Object.entries(previousParsed)) {
    if (!seenKeys.has(k) && v) {
      out.push(`${k}=${formatEnvValue(v)}`);
    }
  }
  return out.join("\n");
}

export function copyInitToWebHome(opts: { force: boolean }): void {
  const paths = ensureConfigDir();
  const initDir = resolvePackageInitDir();
  const sourceConfig = path.join(initDir, "config.toml");
  const sourceEnv = path.join(initDir, ".env.example");
  if (!fs.existsSync(sourceConfig) || !fs.existsSync(sourceEnv)) {
    throw new Error(`init 模板不存在: ${initDir}（需要 config.toml 与 .env.example）`);
  }
  const exists = fs.existsSync(paths.configPath) && fs.statSync(paths.configPath).size > 0;
  if (exists && !opts.force) {
    process.stderr.write(`已存在全局配置: ${paths.configPath}\n`);
    process.stderr.write("若需覆盖，请执行: web onboard init --force\n");
    process.exit(1);
  }
  const previousEnvRaw =
    opts.force && fs.existsSync(paths.envPath) ? fs.readFileSync(paths.envPath, "utf8") : null;
  fs.copyFileSync(sourceConfig, paths.configPath);
  fs.copyFileSync(sourceEnv, paths.envPath);
  if (previousEnvRaw) {
    const templateContent = fs.readFileSync(paths.envPath, "utf8");
    const merged = mergePreviousEnvIntoTemplate(templateContent, dotenv.parse(previousEnvRaw));
    fs.writeFileSync(paths.envPath, merged, "utf8");
  }
  fs.mkdirSync(getUserPluginsRoot(), { recursive: true });
  const readmeEn = path.join(paths.rootDir, "README.md");
  const readmeCn = path.join(paths.rootDir, "README_CN.md");
  if (opts.force) {
    fs.writeFileSync(readmeEn, defaultWebHomeReadme(), "utf8");
    fs.writeFileSync(readmeCn, defaultWebHomeReadmeCn(), "utf8");
  } else {
    if (!fs.existsSync(readmeEn)) {
      fs.writeFileSync(readmeEn, defaultWebHomeReadme(), "utf8");
    }
    if (!fs.existsSync(readmeCn)) {
      fs.writeFileSync(readmeCn, defaultWebHomeReadmeCn(), "utf8");
    }
  }
  syncAgentSkillsFromPackage();
  process.stdout.write(`Initialized: ${paths.rootDir}\n`);
  process.stdout.write(`Config: ${paths.configPath}\n`);
  process.stdout.write(`Env: ${paths.envPath}\n`);
  process.stdout.write(`\n下一步:\n`);
  process.stdout.write(`  1. 编辑 ${paths.envPath}，填入你的 API key\n`);
  process.stdout.write(`  2. 运行 web config list 确认配置\n`);
  process.stdout.write(`  3. 运行 web search "hello world" 测试搜索\n`);
}

export function writeWebHomeReadmeIfMissing(rootDir: string): void {
  const readmeEn = path.join(rootDir, "README.md");
  const readmeCn = path.join(rootDir, "README_CN.md");
  if (!fs.existsSync(readmeEn)) {
    fs.writeFileSync(readmeEn, defaultWebHomeReadme(), "utf8");
  }
  if (!fs.existsSync(readmeCn)) {
    fs.writeFileSync(readmeCn, defaultWebHomeReadmeCn(), "utf8");
  }
}
