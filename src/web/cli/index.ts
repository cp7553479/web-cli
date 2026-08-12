import { Command } from "commander";

import { runCliProgram } from "../../core";
import { version } from "../../../package.json";
import { registerConfigCommand } from "./commands/config";
import { registerFetchCommand } from "./commands/fetch";
import { registerProviderCommand } from "./commands/provider";
import { registerSearchCommand } from "./commands/search";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("web")
    .version(version)
    .description("Web CLI: unified web search + fetch over multi-provider accounts")
    .option("-f, --format <value>", "output format: json|markdown|text", "text")
    .option("--max-length <n>", "max output length (chars)", "10000")
    .option("--timeout-ms <n>", "per-request timeout (ms)", "15000")
    .showHelpAfterError();

  registerSearchCommand(program);
  registerFetchCommand(program);
  registerConfigCommand(program);
  registerProviderCommand(program);

  program.addHelpText(
    "after",
    `
Examples:
  web search "nodejs cli framework" --site github.com npmjs.com --limit 8
  web search "AI news" --provider tavily-main -f markdown
  web fetch https://example.com -f markdown
  web fetch https://example.org --provider jina-reader
  web config init
  web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
  web provider list
`,
  );

  await runCliProgram(program, argv);
}
