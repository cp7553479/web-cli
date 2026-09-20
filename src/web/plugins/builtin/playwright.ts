import { htmlToMarkdown } from "./markdown";
import { makeFactory, makeInstance } from "./factory";
import type { PluginHost, ProviderBinding, ProviderHooks } from "../../../core";
import type { FetchRequest, ProviderResponse } from "../../protocol/types";

/**
 * Minimal structural type for the slice of `playwright` we use, so the build
 * does not need `playwright` readable at compile time.
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
 * `playwright` is `require`-d lazily inside
 * `execute`, so the module loads fine when the package or its browsers are not
 * installed yet — the provider only fails if a user actually configures a
 * `playwright` account without the package present. Because it drives a
 * browser directly, it uses the self-contained `execute` hook and bypasses the
 * HTTP transport.
 *
 * Runs headless by default; an account can set `headless: "false"` (declared
 * in the factory's config schema) to watch the browser. The rendered page is
 * cleaned to readable Markdown with the shared Readability + turndown
 * pipeline; `--selector` returns innerText instead.
 */
export function createPlaywrightFetch(binding: ProviderBinding) {
  const headless = binding.fields?.headless !== "false";
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    async execute(req, ctx) {
      const url = req.urls[0];
      // Lazily require `playwright` so the module loads fine without it; only a
      // configured playwright account triggers this.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require("playwright") as PlaywrightModule;
      const browser = await chromium.launch({ headless });
      const items = [];
      try {
        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();
        try {
          await page.goto(url, { waitUntil: req.waitUntil ?? "load", timeout: ctx.timeoutMs || undefined });
          if (req.selector) {
            const text = await page.locator(req.selector).first().innerText({ timeout: ctx.timeoutMs || undefined });
            items.push({ url, content: text, source: "playwright" });
          } else {
            const html = await page.content();
            let title: string | undefined;
            let markdown: string;
            try {
              ({ title, markdown } = htmlToMarkdown(html));
            } catch {
              markdown = html; // keep the raw page when conversion is impossible
            }
            items.push({ url, title, content: markdown, source: "playwright" });
          }
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

export function activate(host: PluginHost): void {
  const factory = makeFactory(["fetch"], { fetch: createPlaywrightFetch });
  factory.config = [
    {
      key: "headless",
      label: "Headless mode",
      default: "true",
      options: [
        { label: "Headless (no browser window)", value: "true" },
        { label: "Visible browser window", value: "false" },
      ],
    },
  ];
  host.registerFactory("playwright", factory);
}
