import { Command } from "commander";

import {
  getConfigPaths,
  getProjectConfigPaths,
  loadConfig,
  removeModel,
  saveConfig,
  setModel,
} from "../../config";
import { AppError } from "../../core/errors";
import type { GroupName } from "../../config/types";

const VALID_GROUPS: GroupName[] = ["search", "fetch", "research", "answer"];

function asGroupName(group: string): GroupName {
  if (!VALID_GROUPS.includes(group as GroupName)) {
    throw new AppError(
      `Invalid group '${group}'. Must be one of: ${VALID_GROUPS.join(", ")}`,
      "INVALID_PARAM",
    );
  }
  return group as GroupName;
}

function mask(token?: string): string | undefined {
  if (!token) return token;
  if (token.length < 8) return "****";
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

export function registerConfigCommand(program: Command): void {
  const cmd = program.command("config").description("查看/修改 ~/.web/config.toml");

  cmd
    .command("list")
    .description("列出配置")
    .action(() => {
      const cfg = loadConfig();
      const cloned = structuredClone(cfg);
      (["search", "fetch", "research", "answer"] as GroupName[]).forEach((group) => {
        Object.values(cloned[group].account).forEach((model) => {
          model.api_token = mask(model.api_token);
        });
      });
      process.stdout.write(`${JSON.stringify(cloned, null, 2)}\n`);
    });

  cmd
    .command("set-model <group> <alias>")
    .description("新增或更新 account 条目")
    .requiredOption("--provider <provider>", "厂商名 provider")
    .option("--token <token>", "api token，支持 {$ENV_NAME}")
    .option("--base-url <url>", "覆盖默认 endpoint")
    .option("--enabled <trueOrFalse>", "是否启用", "true")
    .action((group, alias, options) => {
      const cfg = loadConfig();
      const next = setModel(cfg, asGroupName(group), alias, {
        provider: options.provider,
        api_token: options.token,
        base_url: options.baseUrl,
        enabled: String(options.enabled) !== "false",
      });
      saveConfig(next);
      process.stdout.write("ok\n");
    });

  cmd
    .command("set <group> <alias>")
    .description("set-model 的简写")
    .requiredOption("--provider <provider>", "厂商名 provider")
    .option("--token <token>", "api token，支持 {$ENV_NAME}")
    .option("--base-url <url>", "覆盖默认 endpoint")
    .option("--enabled <trueOrFalse>", "是否启用", "true")
    .action((group, alias, options) => {
      const cfg = loadConfig();
      const next = setModel(cfg, asGroupName(group), alias, {
        provider: options.provider,
        api_token: options.token,
        base_url: options.baseUrl,
        enabled: String(options.enabled) !== "false",
      });
      saveConfig(next);
      process.stdout.write("ok\n");
    });

  cmd
    .command("remove-model <group> <alias>")
    .description("删除 account 条目")
    .action((group, alias) => {
      const cfg = loadConfig();
      const next = removeModel(cfg, asGroupName(group), alias);
      saveConfig(next);
      process.stdout.write("ok\n");
    });

  cmd.addHelpText(
    "after",
    `
示例:
  web config list
  web config set search kimi-1 --provider kimi --token '{$MOONSHOT_API_KEY}'
  web config remove-model search kimi-2

全局配置（读写）:
  ${getConfigPaths().configPath}
项目覆写（只读合并，存在时）:
  ${getProjectConfigPaths(process.cwd())?.configPath ?? "(无 ./.web/config.toml)"}
`,
  );
}
