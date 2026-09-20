import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global-flags";
import { buildAskRequest } from "../../protocol/requests";
import { parseLooseVendor, parseVendorPairs } from "../../protocol/vendor-params";
import { renderImages } from "../../output/render";
import { emitResult } from "../../output/emit";

const KNOWN_LONG_FLAGS = new Set([
  "model", "provider", "account", "vendor", "format", "max-length", "timeout-ms", "help",
]);

export function registerAskCommand(program: Command): void {
  program
    .command("ask <question>")
    .description("Ask an LLM with the provider's live web-search tool (multi-account failover)")
    .option("--model <provider/model>", "liteLLM-style model id; the provider part routes the pool")
    .option("--provider <aliasOrName>", "pin one account alias or provider type")
    .option("--account <alias>", "pin one account id")
    .option("--vendor <key=value>", "provider-native param (repeatable; merged into the request body)", accumulate, [])
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (question, options, command) => {
      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { config, askPool, logger, paths } = createAppContext(flags);
      logger?.log("cli.command", { command: "ask", args: { question, ...options } });

      const vendorParams = {
        ...parseLooseVendor(command.args ?? [], KNOWN_LONG_FLAGS),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };

      let provider: string | undefined = options.provider;
      let model: string | undefined;
      if (options.model) {
        const slash = options.model.indexOf("/");
        if (slash === -1) {
          model = options.model;
        } else {
          provider = options.model.slice(0, slash);
          model = options.model.slice(slash + 1);
        }
      }

      const request = buildAskRequest({ question, model, vendorParams });
      const result = await askPool.run(request, {
        segment: "ask",
        forcedProvider: provider,
        forcedAccount: options.account,
      });

      const group = config.ask;
      const output = result.items
        .map((item) => item.content ?? "")
        .filter(Boolean)
        .join("\n\n");
      const wrapped = group?.inject_before || group?.inject_after
        ? `${group?.inject_before ?? ""}${output}${group?.inject_after ?? ""}`
        : output;
      emitResult(wrapped, flags, paths);
    });
}

function accumulate(value: string, prev: string[]): string[] {
  return [...prev, value];
}
