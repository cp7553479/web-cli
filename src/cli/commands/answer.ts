import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { rejectConflict } from "../validate";
import { render } from "../../output/renderer";

export function registerAnswerCommand(program: Command): void {
  program
    .command("answer <query>")
    .description("问答接口（DuckDuckGo Instant Answer / Brave Answers）")
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

说明:
  - --providers 与 --account 不可同时使用。
`,
    )
    .action(async (query, options, command) => {
      rejectConflict("--provider", !!options.provider, "--providers", !!options.providers);
      rejectConflict("--providers", !!options.providers, "--account", !!options.account);

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "answer", args: { query, ...options } });
      const request = {
        query,
        noRedirect: options.noRedirect,
        noHtml: options.noHtml,
        skipDisambig: options.skipDisambig,
      };
      const result = options.providers
        ? (app.validateProviders("answer", options.providers), await app.answerMulti(request, options.providers))
        : await app.answer(request, options.provider, options.account);
      const group = config.answer;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}
