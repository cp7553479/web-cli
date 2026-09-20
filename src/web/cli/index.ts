import { Command } from "commander";

import { runCliProgram } from "../../core";
import { version } from "../../../package.json";
import { registerConfigCommand } from "./commands/config";
import { registerDoctorCommand } from "./commands/doctor";
import { registerFetchCommand } from "./commands/fetch";
import { registerProviderCommand } from "./commands/provider";
import { registerAskCommand } from "./commands/ask";
import { registerSearchCommand } from "./commands/search";
import { registerSearchImageCommand } from "./commands/search-image";
import { registerUpdateCommand } from "./commands/update";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("web")
    .version(version)
    .description("Web CLI: unified web search + fetch over multi-provider accounts")
    .option("-f, --format <value>", "output format: json|markdown|text", "markdown")
    .option("--max-length <n>", "max output length (chars); larger output spills to a file", "50000")
    .option("--timeout-ms <n>", "per-request timeout (ms)", "30000")
    .showHelpAfterError();

  registerSearchCommand(program);
  registerFetchCommand(program);
  registerAskCommand(program);
  registerSearchImageCommand(program);
  registerConfigCommand(program);
  registerProviderCommand(program);
  registerDoctorCommand(program);
  registerUpdateCommand(program);

  program.addHelpText(
    "after",
    `
Examples:
  web search "nodejs cli framework" --site github.com npmjs.com --limit 8
  web search "AI news" --provider tavily-main -f markdown
  web search-image "sunset over mountains" --limit 10
  web ask "what changed in nodejs 24?" --model openrouter/deepseek/deepseek-chat-v3.1:free
  web fetch https://example.com -f markdown
  web fetch https://example.org --provider jina-reader
  web config init
  web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
  web doctor --fix
  web update --check
  web provider list
`,
  );

  await runCliProgram(program, argv);
}
