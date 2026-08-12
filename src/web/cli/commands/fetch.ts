import fs from "node:fs";
import path from "node:path";

import { Command } from "commander";

import { createAppContext } from "../context";
import { toGlobalFlags } from "../global-flags";
import { WAIT_UNTIL_VALUES, buildFetchRequest, requireOneOf } from "../../protocol/requests";
import { parseLooseVendor, parseVendorPairs } from "../../protocol/vendor-params";
import type { ProviderResponse } from "../../protocol/types";
import { render } from "../../output/render";

const FETCH_CHAR_LIMIT = 100_000;
const KNOWN_LONG_FLAGS = new Set([
  "provider", "account", "wait-until", "selector", "vendor",
  "format", "max-length", "timeout-ms", "help",
]);

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch <urls...>")
    .description("Fetch web content via configured provider accounts (curl / API / browser)")
    .option("--provider <aliasOrName>", "pin one account alias or provider type")
    .option("--account <alias>", "pin one account id")
    .option("--selector <css>", "extract a DOM region (playwright / html2markdown)")
    .option("--wait-until <value>", "playwright wait strategy: load|domcontentloaded|networkidle", "load")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (urls, options, command) => {
      if (options.waitUntil) requireOneOf(options.waitUntil, WAIT_UNTIL_VALUES, "--wait-until");

      const flags = toGlobalFlags(command.parent?.opts() ?? {});
      const { config, fetchPool, logger, paths } = createAppContext(flags);
      logger?.log("cli.command", { command: "fetch", args: { urls, ...options } });

      const baseVendor = {
        ...parseLooseVendor(command.args ?? [], KNOWN_LONG_FLAGS),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };

      // One pool run per URL (providers handle a single URL per attempt).
      const merged: ProviderResponse = { provider: "", items: [] };
      for (const url of urls) {
        const vendorParams = { ...baseVendor };
        const request = buildFetchRequest({
          urls: [url],
          selector: options.selector,
          waitUntil: options.waitUntil,
          vendorParams,
        });
        const result = await fetchPool.run(request, {
          segment: "fetch",
          forcedProvider: options.provider,
          forcedAccount: options.account,
        });
        merged.items.push(...result.items);
        merged.provider = merged.provider ? `${merged.provider}+${result.provider}` : result.provider;
      }

      const group = config.fetch;
      const output = render(merged, flags.format, flags.maxLength, group.inject_before, group.inject_after);

      if (output.length > FETCH_CHAR_LIMIT) {
        const tempDir = path.join(paths.projectRoot ?? paths.globalRoot, "temp");
        fs.mkdirSync(tempDir, { recursive: true });
        const file = path.join(tempDir, `${Date.now()}.md`);
        fs.writeFileSync(file, output, "utf8");
        process.stdout.write(`Fetch result too large (${output.length} chars). Saved to ${file} — read that file for the full content.\n`);
      } else {
        process.stdout.write(`${output}\n`);
      }
    });
}
