import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { parseVendorPairs } from "../../providers/vendor-params";
import { parseTrailingLooseVendor } from "../loose-vendor-args";
import { rejectConflict } from "../validate";
import { render } from "../../output/renderer";

export function registerAnswerCommand(program: Command): void {
  program
    .command("answer <query>")
    .description("问答接口（各厂商官方 answer API）")
    .option("--url <url>", "Firecrawl interact：先 scrape 的页面 URL（官方两步流程）")
    .option(
      "--vendor <key=value>",
      "厂商扩展参数（可重复）。仅白名单键生效；例如 `--vendor model=sonar-pro`",
      (v: string, prev: string[]) => [...prev, v],
      [] as string[],
    )
    .option("--provider <aliasOrProvider>", "指定单个 answer provider")
    .option("--account <id>", "指定单个 account id（可与 --provider 组合校验厂商）")
    .option("--providers <names...>", "同时使用多个 answer provider（并发查询，合并结果）")
    .option("--no-redirect", "DDG: 禁止跳转")
    .option("--no-html", "DDG: 去除 html")
    .option("--skip-disambig", "DDG: 跳过歧义")
    .addHelpText(
      "after",
      `
示例:
  web answer "What is Rust?" --provider ddg-main
  web answer "AI trends" --providers ddg-main brave-answer
  web answer "提取价格" --provider firecrawl-scrape --url https://example.com

说明:
  - --providers 与 --account 不可同时使用。
  - Firecrawl interact 需同时传 --url。
  - 未注册的 \`--键 值\` / \`--键=值\` 与 --vendor 合并（后者覆盖同名键），仅白名单键发往 API。
`,
    )
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (query, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "answer", args: { query, ...options } });
      const vendorParams = {
        ...parseTrailingLooseVendor(command),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };
      const request = {
        query,
        url: options.url,
        noRedirect: options.noRedirect,
        noHtml: options.noHtml,
        skipDisambig: options.skipDisambig,
        vendorParams: Object.keys(vendorParams).length ? vendorParams : undefined,
      };
      const result = options.providers
        ? (app.validateProviders("answer", options.providers), await app.answerMulti(request, options.providers))
        : await app.answer(request, options.provider, options.account);
      const group = config.answer;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}
