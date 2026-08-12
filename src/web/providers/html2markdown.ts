import { ProviderError } from "../../core";
import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { FetchRequest, ProviderResponse } from "../protocol/types";
import { ensureSuccess } from "./_http";
import { makeInstance } from "./_factory";

// Vendored, framework-free converters (no npm dependency).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Readability = require("../../vendor/Readability");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TurndownService = require("../../vendor/turndown");

/**
 * Local HTML→Markdown fetch. Uses the transport to GET the page, then runs
 * Mozilla Readability + turndown locally (no external API, no key required).
 */
export function createHtml2MarkdownFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      return {
        method: "GET",
        url: req.urls[0],
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebCLI/1.0)" },
      };
    },
    parseResponse(result, req): ProviderResponse {
      ensureSuccess("html2markdown", result);
      const html = result.bodyText;
      let markdown: string;
      let title: string | undefined;
      try {
        const document = parseDocument(html);
        const article = new Readability(document).parse();
        title = article?.title;
        if (article?.content) {
          const contentDoc = parseDocument(article.content);
          const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
          markdown = turndown.turndown(contentDoc.documentElement);
        } else {
          markdown = article?.textContent ?? html;
        }
      } catch (error) {
        throw new ProviderError(
          "non-retryable-request",
          `html2markdown: failed to convert ${req.urls[0]}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return {
        provider: binding.alias,
        items: [{ title: title ?? req.urls[0], url: req.urls[0], content: markdown, source: "html2markdown" }],
      };
    },
  };
  return makeInstance(binding, hooks);
}

function parseDocument(html: string): Record<string, unknown> {
  // linkedom is the one admitted DOM dependency for this provider.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseHTML } = require("linkedom");
  return parseHTML(html).document;
}
