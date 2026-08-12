import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global-flags";
import {
  FRESHNESS_VALUES,
  buildSearchRequest,
  requireOneOf,
  requirePositiveInt,
} from "../../protocol/requests";
import { parseLooseVendor, parseVendorPairs } from "../../protocol/vendor-params";
import { render } from "../../output/render";

const KNOWN_LONG_FLAGS = new Set([
  "site", "country", "freshness", "limit", "language", "safesearch",
  "vendor", "provider", "account", "format", "max-length", "timeout-ms", "help",
]);

export function registerSearchCommand(program: Command): void {
  program
    .command("search <text>")
    .description("Web search via configured provider accounts (official APIs)")
    .option("--site <domains...>", "domain include filter (repeatable / multi)")
    .option("--country <code>", "country/region hint (mapped per provider)")
    .option("--freshness <value>", "time filter: day|week|month|year")
    .option("--limit <n>", "result count", "5")
    .option("--language <code>", "language code")
    .option("--safesearch <level>", "safe-search level (mapped per provider)")
    .option("--vendor <key=value>", "provider-native param (repeatable; allowlist-filtered)", accumulate, [])
    .option("--provider <aliasOrName>", "pin one account alias or provider type")
    .option("--account <alias>", "pin one account id")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (text, options, command) => {
      const limit = requirePositiveInt(options.limit ?? 5, "--limit", 5);
      if (options.freshness) requireOneOf(options.freshness, FRESHNESS_VALUES, "--freshness");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { config, searchPool, logger } = createAppContext(flags);
      logger?.log("cli.command", { command: "search", args: { text, ...options } });

      const vendorParams = {
        ...parseLooseVendor(command.args ?? [], KNOWN_LONG_FLAGS),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };

      const request = buildSearchRequest({
        query: text,
        limit,
        site: options.site,
        country: options.country,
        freshness: options.freshness,
        language: options.language,
        safesearch: options.safesearch,
        vendorParams,
      });

      const result = await searchPool.run(request, {
        segment: "search",
        forcedProvider: options.provider,
        forcedAccount: options.account,
      });

      const group = config.search;
      const output = render(result, flags.format, flags.maxLength, group.inject_before, group.inject_after);
      process.stdout.write(`${output}\n`);
    });
}

function accumulate(value: string, prev: string[]): string[] {
  return [...prev, value];
}
