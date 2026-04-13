import { chromium } from "playwright";

import type { FetchRequest, ProviderContext, ProviderResponse, ResultItem } from "../core/types";
import { errorLog } from "../core/logger";

export async function fetchWithPlaywright(
  request: FetchRequest,
  context: ProviderContext,
): Promise<ProviderResponse> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const items: ResultItem[] = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const url of request.urls) {
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      try {
        await page.goto(url, { waitUntil: request.waitUntil ?? "load", timeout: context.timeoutMs });
        const content = request.selector
          ? await page.locator(request.selector).first().innerText({ timeout: context.timeoutMs })
          : await page.content();
        items.push({ url, content, source: "playwright" });
      } finally {
        await page.close();
        await browserContext.close();
      }
    }
    const output: ProviderResponse = { provider: "playwright", items };
    return output;
  } catch (error) {
    errorLog("playwright.fetch.error", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

