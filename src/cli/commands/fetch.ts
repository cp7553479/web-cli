import fs from "node:fs";
import path from "node:path";

import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global";
import { requireOneOf } from "../validate";
import { render } from "../../output/renderer";

const FETCH_CHAR_LIMIT = 100_000;
const WAIT_UNTIL_VALUES = ["load", "domcontentloaded", "networkidle"] as const;

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch <url...>")
    .description("网页内容抓取（按 [fetch.account.*] 链与 --provider / --account）")
    .option("--provider <aliasOrProvider>", "强制使用指定 account id 或厂商名")
    .option("--account <id>", "强制使用指定 account id（可与 --provider 组合校验厂商）")
    .option("--wait-until <value>", "playwright 等待策略 load|domcontentloaded|networkidle", "load")
    .option("--selector <css>", "提取特定 DOM 选择器")
    .option("--screenshot", "截图（预留参数）", false)
    .addHelpText(
      "after",
      `
示例:
  web fetch https://example.com
  web fetch https://example.com https://example.org --provider jina-reader -f markdown
  web fetch https://news.ycombinator.com --provider playwright --wait-until networkidle

执行策略:
  按 config.toml 中 [fetch.account.*] 的声明顺序依次尝试；--provider / --account 用于缩小或固定账号（与 web search 一致）。
`,
    )
    .action(async (urls, options, command) => {
      if (options.waitUntil) requireOneOf(options.waitUntil, WAIT_UNTIL_VALUES, "--wait-until");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { app, config, fileLogger } = createAppContext(flags);
      fileLogger?.log("cli.command", { command: "fetch", args: { urls, ...options } });
      const result = await app.fetch(
        {
          urls,
          selector: options.selector,
          waitUntil: options.waitUntil,
          screenshot: options.screenshot,
        },
        options.provider,
        options.account,
      );
      const group = config.fetch;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);

      if (output.length > FETCH_CHAR_LIMIT) {
        const tempDir = path.join(process.cwd(), ".web", "temp");
        fs.mkdirSync(tempDir, { recursive: true });
        const fileName = `${Date.now()}.md`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, output, "utf8");
        process.stdout.write(`Fetch result too large (${output.length} chars). Saved to ${filePath} — read that file for the full content.\n`);
      } else {
        process.stdout.write(`${output}\n`);
      }
    });
}
