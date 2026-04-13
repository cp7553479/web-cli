import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { rejectConflict, requireOneOf, requirePositiveInt } from "../validate";
import { render } from "../../output/renderer";

const FRESHNESS_VALUES = ["day", "week", "month", "year"] as const;

export function registerSearchCommand(program: Command): void {
  program
    .command("search <text>")
    .description("Web 搜索（官方 API）")
    .option("--site <domains...>", "按域名过滤，例如 baidu.com google.com")
    .option("--limit <n>", "返回结果数量", "5")
    .option("--freshness <value>", "时间过滤 day|week|month|year")
    .option("--language <code>", "语言代码")
    .option("--region <code>", "地区代码")
    .option("--provider <aliasOrProvider>", "指定单个 provider")
    .option("--account <id>", "指定单个 account id（可与 --provider 组合校验厂商）")
    .option("--providers <names...>", "同时使用多个 provider（并发查询，合并结果）")
    .addHelpText(
      "after",
      `
示例:
  web search "nodejs cli framework" --site github.com npmjs.com --limit 8
  web search "AI 搜索 API" --provider tavily-main -f markdown
  web search "AI news" --providers jina-main tavily-main

说明:
  - --provider：指定单个 provider（alias 或 provider 类型名），失败后按配置顺序尝试下一个。
  - --account：固定使用某个 account id；可与 --provider 一起校验该账号是否属于该厂商。
  - --providers：同时向多个 provider 发起查询，合并所有结果返回（不可与 --account 同用）。
  - 若都不传，按 config.toml 里 [search.account.*] 的声明顺序依次尝试。
`,
    )
    .action(async (text, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);
      const limit = requirePositiveInt(options.limit ?? 5, "--limit");
      if (options.freshness) requireOneOf(options.freshness, FRESHNESS_VALUES, "--freshness");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "search", args: { text, ...options } });
      const request = {
        query: text,
        site: options.site,
        limit,
        freshness: options.freshness,
        language: options.language,
        region: options.region,
      };
      const result = options.providers
        ? (app.validateProviders("search", options.providers), await app.searchMulti(request, options.providers))
        : await app.search(request, options.provider, options.account);
      const group = config.search;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}

