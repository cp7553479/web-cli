import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { rejectConflict, requirePositiveInt } from "../validate";
import { render } from "../../output/renderer";

export function registerResearchCommand(program: Command): void {
  program
    .command("research <text>")
    .description("多步研究（search -> fetch -> 汇总）")
    .option("--max-steps <n>", "预留参数，当前版本未启用", "2")
    .option("--max-sources <n>", "最多抓取来源数", "5")
    .option("--cite", "输出中附带来源", true)
    .option("--provider <aliasOrProvider>", "指定单个搜索 provider")
    .option("--account <id>", "指定搜索步使用的 account id（仅作用于 search；可与 --provider 组合校验）")
    .option("--providers <names...>", "同时使用多个搜索 provider（并发查询，合并结果）")
    .addHelpText(
      "after",
      `
示例:
  web research "2026 Node.js CLI best practices" --max-sources 6 -f markdown
  web research "AI trends 2026" --providers jina-main tavily-main

说明:
  - --account 仅影响「搜索」步骤；后续 fetch 仍按 [fetch.account.*] 默认链。
  - --providers 与 --account 不可同时使用。
`,
    )
    .action(async (text, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);
      const maxSources = requirePositiveInt(options.maxSources ?? 5, "--max-sources");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "research", args: { text, ...options } });
      const result = options.providers
        ? (app.validateProviders("search", options.providers), await app.researchMulti(text, maxSources, options.providers))
        : await app.research(text, maxSources, options.provider, options.account);
      const group = config.research;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}

