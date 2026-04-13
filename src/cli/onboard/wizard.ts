import fs from "node:fs";

import { getConfigPaths, readGlobalWebConfigToml, saveConfig } from "../../config";
import { defaultConfig } from "../../config/defaults";
import type { GroupName, ModelConfig, WebConfig } from "../../config/types";
import { getUserPluginsRoot } from "../../plugins/loader";
import { copyInitToWebHome, writeWebHomeReadmeIfMissing } from "./init-copy";
import { syncAgentSkillsFromPackage } from "./sync-skills";

type WizardChoice = {
  value: string;
  group: GroupName;
  alias: string;
  label: string;
  provider: string;
  tokenEnv?: string;
};

const WIZARD_CHOICES: WizardChoice[] = [
  { value: "s-tavily", group: "search", alias: "tavily-main", label: "Search · Tavily", provider: "tavily", tokenEnv: "TAVILY_API_KEY" },
  { value: "s-brave", group: "search", alias: "brave-main", label: "Search · Brave", provider: "brave", tokenEnv: "BRAVE_API_TOKEN" },
  { value: "s-kimi", group: "search", alias: "kimi-main", label: "Search · Kimi", provider: "kimi", tokenEnv: "MOONSHOT_API_KEY" },
  { value: "s-jina", group: "search", alias: "jina-main", label: "Search · Jina", provider: "jina", tokenEnv: "JINA_API_KEY" },
  { value: "s-fc", group: "search", alias: "firecrawl-main", label: "Search · Firecrawl", provider: "firecrawl", tokenEnv: "FIRECRAWL_API_KEY" },
  { value: "s-px", group: "search", alias: "perplexity-main", label: "Search · Perplexity", provider: "perplexity", tokenEnv: "PERPLEXITY_API_KEY" },
  { value: "f-http", group: "fetch", alias: "http-main", label: "Fetch · HTTP 直连（无密钥）", provider: "http" },
  { value: "f-html2md", group: "fetch", alias: "html2markdown-main", label: "Fetch · html2markdown 本地转换（无密钥）", provider: "html2markdown" },
  { value: "f-jina", group: "fetch", alias: "jina-reader", label: "Fetch · Jina Reader", provider: "jina", tokenEnv: "JINA_API_KEY" },
  { value: "f-fc", group: "fetch", alias: "firecrawl-scrape", label: "Fetch · Firecrawl", provider: "firecrawl", tokenEnv: "FIRECRAWL_API_KEY" },
  { value: "f-kimi", group: "fetch", alias: "kimi-fetch", label: "Fetch · Kimi", provider: "kimi", tokenEnv: "MOONSHOT_API_KEY" },
  { value: "f-pw", group: "fetch", alias: "playwright-main", label: "Fetch · Playwright 无头浏览器", provider: "playwright" },
  { value: "a-ddg", group: "answer", alias: "ddg-main", label: "Answer · DuckDuckGo", provider: "duckduckgo" },
  { value: "a-brave", group: "answer", alias: "brave-answer", label: "Answer · Brave", provider: "brave", tokenEnv: "BRAVE_API_TOKEN" },
  { value: "a-gemini", group: "answer", alias: "gemini-main", label: "Answer · Gemini + Google 搜索", provider: "gemini", tokenEnv: "GEMINI_API_KEY" },
];

function preselectedFromConfig(cfg: WebConfig): string[] {
  const out: string[] = [];
  for (const c of WIZARD_CHOICES) {
    const m = cfg[c.group].account[c.alias];
    if (m && m.enabled !== false) {
      out.push(c.value);
    }
  }
  return out;
}

function buildConfig(selected: Set<string>, envValues: Record<string, string>): WebConfig {
  const cfg = defaultConfig();
  cfg.search = { account: {} };
  cfg.fetch = { account: {} };
  cfg.answer = { account: {} };
  cfg.research = { account: {} };
  cfg.runtime = {};

  for (const c of WIZARD_CHOICES) {
    if (!selected.has(c.value)) continue;
    const model: ModelConfig = {
      provider: c.provider,
      enabled: true,
      ...(c.tokenEnv ? { api_token: `{$${c.tokenEnv}}` } : {}),
    };
    cfg[c.group].account[c.alias] = model;
  }

  if (!Object.values(cfg.fetch.account).some((m) => m.provider === "http")) {
    cfg.fetch.account["http-main"] = { provider: "http", enabled: true };
  }
  if (!Object.values(cfg.fetch.account).some((m) => m.provider === "html2markdown")) {
    cfg.fetch.account["html2markdown-main"] = { provider: "html2markdown", enabled: true };
  }
  if (!Object.values(cfg.fetch.account).some((m) => m.provider === "playwright")) {
    cfg.fetch.account["playwright-main"] = { provider: "playwright", enabled: true };
  }

  if (Object.keys(cfg.answer.account).length === 0) {
    cfg.answer.account["ddg-main"] = { provider: "duckduckgo", enabled: true };
  }

  const researchProviders = new Set(["tavily", "perplexity"]);
  for (const c of WIZARD_CHOICES) {
    if (c.group !== "search" || !researchProviders.has(c.provider)) continue;
    if (!selected.has(c.value)) continue;
    const m = cfg.search.account[c.alias];
    if (m) cfg.research.account[c.alias] = { ...m };
  }

  return cfg;
}

function mergeEnvFile(envPath: string, updates: Record<string, string>): void {
  const lines: string[] = [];
  if (fs.existsSync(envPath)) {
    lines.push(...fs.readFileSync(envPath, "utf8").split("\n"));
  }
  const keys = new Set(Object.keys(updates));
  const kept = lines.filter((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && keys.has(m[1])) return false;
    return true;
  });
  const tail = Object.entries(updates)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, [...kept.filter((l) => l.trim() !== ""), ...tail].join("\n") + "\n", "utf8");
}

export async function runOnboardWizard(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("当前不是交互式终端。请使用: web onboard init\n");
    process.exit(1);
  }

  const { checkbox, confirm, password } = await import("@inquirer/prompts");

  const paths = getConfigPaths();
  const hadConfig = fs.existsSync(paths.configPath) && fs.statSync(paths.configPath).size > 0;

  if (!hadConfig) {
    copyInitToWebHome({ force: true });
  }

  let cfgToml = readGlobalWebConfigToml();
  let defaultSelected = preselectedFromConfig(cfgToml);

  if (hadConfig) {
    const keep = await confirm({
      message: "在现有 ~/.web 配置基础上调整启用项？（否：多选默认全清空，重新勾选）",
      default: true,
    });
    if (!keep) {
      defaultSelected = [];
    }
  }

  const initial =
    defaultSelected.length > 0
      ? defaultSelected
      : WIZARD_CHOICES.map((c) => c.value).filter(
          (v) => v === "f-http" || v === "f-html2md" || v === "f-pw" || v === "a-ddg",
        );
  const selectedValues = await checkbox({
    message: "选择要启用的能力（空格切换，回车确认）",
    choices: WIZARD_CHOICES.map((c) => ({
      name: c.label,
      value: c.value,
      checked: initial.includes(c.value),
    })),
  });

  const selected = new Set(selectedValues as string[]);
  if (!selected.has("f-http")) {
    selected.add("f-http");
  }
  if (!selected.has("f-html2md")) {
    selected.add("f-html2md");
  }
  if (!selected.has("f-pw")) {
    selected.add("f-pw");
  }

  const searchPicked = WIZARD_CHOICES.some((c) => c.group === "search" && selected.has(c.value));
  if (!searchPicked) {
    process.stderr.write("请至少选择一种 Search 能力。\n");
    process.exit(1);
  }

  const tokenNames = new Set<string>();
  for (const c of WIZARD_CHOICES) {
    if (selected.has(c.value) && c.tokenEnv) tokenNames.add(c.tokenEnv);
  }

  const envValues: Record<string, string> = {};
  for (const name of tokenNames) {
    const v = await password({
      message: `${name}（可留空稍后写入 ~/.web/.env）:`,
      mask: "*",
    });
    envValues[name] = (v as string) ?? "";
  }

  const next = buildConfig(selected, envValues);
  saveConfig(next);
  mergeEnvFile(paths.envPath, envValues);
  fs.mkdirSync(getUserPluginsRoot(), { recursive: true });
  writeWebHomeReadmeIfMissing(paths.rootDir);
  syncAgentSkillsFromPackage();

  process.stdout.write(`\n已写入:\n  ${paths.configPath}\n  ${paths.envPath}\n`);
  process.stdout.write("\n下一步: web config list\n");
}
