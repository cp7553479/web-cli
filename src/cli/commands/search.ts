import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { parseTrailingLooseVendor } from "../loose-vendor-args";
import { buildSearchRequest } from "../vendor-cli";
import { rejectConflict, requireOneOf, requirePositiveInt } from "../validate";
import { render } from "../../output/renderer";

const FRESHNESS_VALUES = ["day", "week", "month", "year"] as const;

export function registerSearchCommand(program: Command): void {
  program
    .command("search <text>")
    .description("Web 搜索（官方 API）")
    .option("--site <domains...>", "按域名过滤，例如 baidu.com google.com")
    .option("--sites <domains...>", "同 --site，可多组")
    .option("--country <code>", "国家/地区（厂商支持则映射，否则忽略）")
    .option("--countries <codes...>", "同 --country，多值时以逗号拼入单一 country 字段（厂商侧仅取支持格式）")
    .option("--safesearch <level>", "安全搜索级别（厂商支持则映射，否则忽略）")
    .option("--limit <n>", "返回结果数量", "5")
    .option("--freshness <value>", "时间过滤 day|week|month|year")
    .option("--language <code>", "语言代码")
    .option("--region <code>", "地区代码")
    .option(
      "--vendor <key=value>",
      "厂商原生参数（可重复；仅白名单键会发往 API）",
      (v: string, prev: string[]) => [...prev, v],
      [] as string[],
    )
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
  web search "天气" --vendor include_answer=true

说明:
  - --provider：指定单个 provider（alias 或 provider 类型名），失败后按配置顺序尝试下一个。
  - --account：固定使用某个 account id；可与 --provider 一起校验该账号是否属于该厂商。
  - --providers：同时向多个 provider 发起查询，合并所有结果返回（不可与 --account 同用）。
  - --vendor：仅当前 provider 文档允许的键会进入请求体，其余静默忽略。
  - 亦可直接写未注册的 \`--键名 值\` 或 \`--键名=值\`（与 --vendor 合并；后者覆盖同名键）。
  - 若都不传，按 config.toml 里 [search.account.*] 的声明顺序依次尝试。
`,
    )
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (text, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);
      const limit = requirePositiveInt(options.limit ?? 5, "--limit");
      if (options.freshness) requireOneOf(options.freshness, FRESHNESS_VALUES, "--freshness");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "search", args: { text, ...options } });
      const request = buildSearchRequest({
        text,
        limit,
        site: options.site,
        sites: options.sites,
        countries: options.countries,
        freshness: options.freshness,
        language: options.language,
        region: options.region,
        country: options.country,
        safesearch: options.safesearch,
        looseVendor: parseTrailingLooseVendor(command),
        vendor: options.vendor as string[] | undefined,
      });
      const result = options.providers
        ? (app.validateProviders("search", options.providers), await app.searchMulti(request, options.providers))
        : await app.search(request, options.provider, options.account);
      const group = config.search;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}
