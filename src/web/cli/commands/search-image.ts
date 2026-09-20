import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global-flags";
import { buildImageSearchRequest, requirePositiveInt } from "../../protocol/requests";
import { parseLooseVendor, parseVendorPairs } from "../../protocol/vendor-params";
import { renderImages } from "../../output/render";
import { emitResult } from "../../output/emit";

const KNOWN_LONG_FLAGS = new Set([
  "limit", "provider", "account", "vendor", "format", "max-length", "timeout-ms", "help",
]);

export function registerSearchImageCommand(program: Command): void {
  program
    .command("search-image <query>")
    .description("Image search via configured provider accounts (official APIs)")
    .option("--limit <n>", "result count", "10")
    .option("--provider <aliasOrName>", "pin one account alias or provider type")
    .option("--account <alias>", "pin one account id")
    .option("--vendor <key=value>", "provider-native param (repeatable; allowlist-filtered)", accumulate, [])
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (query, options, command) => {
      const limit = requirePositiveInt(options.limit ?? 10, "--limit", 10);

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { config, imagesPool, logger, paths } = createAppContext(flags);
      logger?.log("cli.command", { command: "search-image", args: { query, ...options } });

      const vendorParams = {
        ...parseLooseVendor(command.args ?? [], KNOWN_LONG_FLAGS),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };

      const request = buildImageSearchRequest({ query, limit, vendorParams });
      const result = await imagesPool.run(request, {
        segment: "images",
        forcedProvider: options.provider,
        forcedAccount: options.account,
      });

      const group = config.images;
      const output = renderImages(result, flags.format, group?.inject_before, group?.inject_after);
      emitResult(output, flags, paths);
    });
}

function accumulate(value: string, prev: string[]): string[] {
  return [...prev, value];
}
