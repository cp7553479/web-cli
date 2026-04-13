import { request } from "undici";

import { errorLog } from "../core/logger";
import type { FetchRequest, ProviderContext, ProviderResponse } from "../core/types";
import type { ProviderModelOptions } from "./options";
import type { FetchProvider } from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Readability = require("../vendor/Readability");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TurndownService = require("../vendor/turndown");

async function htmlToDocument(html: string): Promise<any> {
  const { parseHTML } = await import("linkedom");
  return parseHTML(html).document;
}

export class Html2MarkdownFetchProvider implements FetchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async fetch(req: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    const items = [];
    for (const url of req.urls) {
      try {
        const res = await request(url, {
          headersTimeout: context.timeoutMs,
          bodyTimeout: context.timeoutMs,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; WebCLI/1.0)" },
        });
        const html = await res.body.text();
        context.fileLogger?.log("html2markdown.fetch.html_length", { url, length: html.length });

        const document = await htmlToDocument(html);
        const reader = new Readability(document);
        const article = reader.parse();

        let markdown: string;
        if (article?.content) {
          const contentDoc = await htmlToDocument(article.content);
          const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
          markdown = td.turndown(contentDoc.documentElement);
        } else {
          markdown = article?.textContent ?? html;
        }

        const title = article?.title ?? url;
        items.push({ title, url, content: markdown, source: "html2markdown" });
      } catch (error) {
        errorLog(`html2markdown.fetch.url_failed:${url}`, error);
        items.push({ url, content: `Error: ${error instanceof Error ? error.message : String(error)}`, source: "html2markdown" });
      }
    }
    const out: ProviderResponse = { provider: this.id, items };
    return out;
  }
}
