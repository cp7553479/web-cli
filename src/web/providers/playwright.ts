import type { ProviderBinding, ProviderHooks } from "../../core";
import type { FetchRequest, ProviderResponse } from "../protocol/types";
import { makeInstance } from "./_factory";

/**
 * Minimal structural type for the slice of `playwright` we use, so the build
 * does NOT need `playwright` installed (it is an optional dependency).
 */
interface PlaywrightModule {
  chromium: { launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}
interface PlaywrightBrowser {
  newContext(): Promise<PlaywrightContext>;
  close(): Promise<unknown>;
}
interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<unknown>;
}
interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  locator(selector: string): { first(): { innerText(options?: { timeout?: number }): Promise<string> } };
  content(): Promise<string>;
  close(): Promise<unknown>;
}

/**
 * Browser-driven fetch for JS-heavy / SPA pages (curl cannot render them).
 *
 * `playwright` is an OPTIONAL dependency: it is `require`-d lazily inside
 * `execute`, so the module loads fine when playwright is not installed — the
 * provider only fails if a user actually configures a `playwright` account
 * without the package present. Because it drives a browser directly, it uses
 * the self-contained `execute` hook and bypasses the HTTP transport.
 */
export function createPlaywrightFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    async execute(req, ctx) {
      const url = req.urls[0];
      // Lazily require the optional `playwright` dependency so the module loads
      // fine without it; only a configured playwright account triggers this.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require("playwright") as PlaywrightModule;
      const browser = await chromium.launch({ headless: true });
      const items = [];
      try {
        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();
        try {
          await page.goto(url, { waitUntil: req.waitUntil ?? "load", timeout: ctx.timeoutMs || undefined });
          const content = req.selector
            ? await page.locator(req.selector).first().innerText({ timeout: ctx.timeoutMs || undefined })
            : await page.content();
          items.push({ url, content, source: "playwright" });
        } finally {
          await page.close();
          await browserContext.close();
        }
      } finally {
        await browser.close();
      }
      return { provider: binding.alias, items };
    },
  };
  return makeInstance(binding, hooks);
}
