import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { parseVendorPairs } from "../../providers/vendor-params";
import { parseTrailingLooseVendor } from "../loose-vendor-args";
import { rejectConflict, requirePositiveInt } from "../validate";
import { render } from "../../output/renderer";

export function registerResearchCommand(program: Command): void {
  program
    .command("research <text>")
    .description("深度研究（各厂商官方 research API，无本地 search+fetch 编排）")
    .option("--max-steps <n>", "预留参数，当前版本未启用", "2")
    .option("--max-sources <n>", "与厂商请求相关的上限提示（默认传给 limit）", "5")
    .option("--cite", "输出中附带来源", true)
    .option(
      "--vendor <key=value>",
      "厂商扩展参数（可重复）。仅各 provider 文档白名单内的键会写入官方请求；例如 `--vendor model=sonar-pro`、`--vendor include_answer=true`",
      (v: string, prev: string[]) => [...prev, v],
      [] as string[],
    )
    .option("--provider <aliasOrProvider>", "指定单个 research provider")
    .option("--account <id>", "指定 [research.account.*] 中的 account id")
    .option("--providers <names...>", "多个 research provider 并发调用后合并输出")
    .addHelpText(
      "after",
      `
示例:
  web research "2026 Node.js CLI best practices" --max-sources 6 -f markdown

说明:
  - 使用 config.toml 中 [research.account.*] 顺序；仅支持官方 research API 的厂商（如 tavily、perplexity）会注册。
  - --providers 与 --account 不可同时使用。
  - 与 web search 不同：不会自动串联 search→fetch。
  - 未注册的 \`--键 值\` / \`--键=值\` 与 --vendor 合并（后者覆盖同名键）。
`,
    )
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (text, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);
      const maxSources = requirePositiveInt(options.maxSources ?? 5, "--max-sources");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "research", args: { text, ...options } });
      const vendorParams = {
        ...parseTrailingLooseVendor(command),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };
      const request = {
        query: text,
        limit: maxSources,
        vendorParams: Object.keys(vendorParams).length ? vendorParams : undefined,
      };
      const result = options.providers
        ? (app.validateProviders("research", options.providers), await app.researchMulti(request, options.providers))
        : await app.research(request, options.provider, options.account);
      const group = config.research;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}
