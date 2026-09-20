import { Command } from "commander";

import { AppError } from "../../../core";
import type { HookCtx } from "../../../core";
import { createAppContext } from "../context";
import { toGlobalFlags } from "../global-flags";
import { WAIT_UNTIL_VALUES, buildFetchRequest, requireOneOf } from "../../protocol/requests";
import { parseLooseVendor, parseVendorPairs } from "../../protocol/vendor-params";
import type { ProviderResponse } from "../../protocol/types";
import { render } from "../../output/render";
import { emitResult } from "../../output/emit";

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
      const { config, fetchPool, fetchRegistry, host, logger, paths } = createAppContext(flags);
      logger?.log("cli.command", { command: "fetch", args: { urls, ...options } });

      const baseVendor = {
        ...parseLooseVendor(command.args ?? [], KNOWN_LONG_FLAGS),
        ...parseVendorPairs(options.vendor as string[] | undefined),
      };

      // Pinning a NON-playwright provider is an explicit contract: no fallback.
      const pinnedProvider = options.account
        ? config.fetch.account?.[options.account]?.provider
        : options.provider;
      const allowFallback = !pinnedProvider || pinnedProvider === "playwright";

      const runPool = async (): Promise<ProviderResponse> => {
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
        return merged;
      };

      let result: ProviderResponse | undefined;
      let poolError: unknown;
      const hasFetchAccounts = fetchRegistry.list("fetch").length > 0;

      if (hasFetchAccounts) {
        try {
          result = await runPool();
        } catch (error) {
          if (!allowFallback) throw error;
          poolError = error;
          logger?.log("fetch.playwright_fallback", {
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (!allowFallback) {
        throw new AppError(
          "fetch: no accounts configured under [fetch.account.*].",
          "FETCH_NO_ACCOUNTS",
        );
      }

      // Default fallback: browser rendering when nothing else is configured or
      // everything configured failed (timeouts, quota, auth, ...).
      if (!result) {
        try {
          result = await runPlaywrightFallback(urls, { selector: options.selector, waitUntil: options.waitUntil, vendor: baseVendor }, host, flags.timeoutMs);
        } catch (fallbackError) {
          if (poolError) throw poolError;
          throw fallbackError;
        }
      }

      const group = config.fetch;
      const output = render(result, flags.format, group.inject_before, group.inject_after);
      emitResult(output, flags, paths);
    });
}

/**
 * Renders URLs through the playwright factory directly — no configured account
 * needed. Used as the fetch fallback (headless by default).
 */
async function runPlaywrightFallback(
  urls: string[],
  opts: { selector?: string; waitUntil?: string; vendor: Record<string, unknown> },
  host: ReturnType<typeof createAppContext>["host"],
  timeoutMs: number,
): Promise<ProviderResponse> {
  const factory = host.getFactory("playwright");
  if (!factory || !factory.capabilities.includes("fetch")) {
    throw new AppError("Playwright fallback is unavailable (factory not registered).", "FETCH_FALLBACK_UNAVAILABLE");
  }
  const instance = factory.create("fetch", { alias: "playwright", providerName: "playwright", fields: {} });
  const ctx: HookCtx = { account: instance.account, timeoutMs };
  const merged: ProviderResponse = { provider: "playwright", items: [] };
  for (const url of urls) {
    const request = buildFetchRequest({
      urls: [url],
      selector: opts.selector,
      waitUntil: opts.waitUntil as "load" | "domcontentloaded" | "networkidle" | undefined,
      vendorParams: { ...opts.vendor },
    });
    const result = (await instance.hooks.execute!(request, ctx)) as ProviderResponse;
    merged.items.push(...result.items);
  }
  return merged;
}
