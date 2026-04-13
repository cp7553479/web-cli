import { Command } from "commander";

import { registerAnswerCommand } from "./commands/answer";
import { registerConfigCommand } from "./commands/config";
import { registerFetchCommand } from "./commands/fetch";
import { registerOnboardCommand } from "./commands/onboard";
import { registerPluginsCommand } from "./commands/plugins";
import { registerResearchCommand } from "./commands/research";
import { registerSearchCommand } from "./commands/search";
import { AppError } from "../core/errors";

function formatUserError(error: unknown): string {
  if (error instanceof AppError) {
    const lines = [error.message];
    if (error.details) lines.push(typeof error.details === "string" ? error.details : JSON.stringify(error.details, null, 2));
    return lines.join("\n");
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("web")
    .description("Web CLI for multi-provider web search tools")
    .option("-f, --format <value>", "输出格式: json|markdown|text", "text")
    .option("--stdout", "输出到 stdout", true)
    .option("--max-length <n>", "最大输出长度", "10000")
    .option("--timeout-ms <n>", "请求超时(ms)", "15000")
    .showHelpAfterError();

  registerSearchCommand(program);
  registerFetchCommand(program);
  registerResearchCommand(program);
  registerAnswerCommand(program);
  registerConfigCommand(program);
  registerOnboardCommand(program);
  registerPluginsCommand(program);

  program.addHelpText(
    "after",
    `
Examples:
  web search "typescript cli" --site github.com npmjs.com
  web fetch https://example.com -f markdown
  web research "official search api providers"
  web answer "what is bun runtime?"
  web onboard init
`,
  );

  try {
    await program.parseAsync(argv);
  } catch (error) {
    process.stderr.write(`Error: ${formatUserError(error)}\n`);
    process.exitCode = 1;
  }
}

