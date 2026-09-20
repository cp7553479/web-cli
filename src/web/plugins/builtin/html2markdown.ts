import { ProviderError } from "../../../core";
import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../core";
import type { FetchRequest, ProviderResponse } from "../../protocol/types";
import { ensureSuccess } from "./shared";
import { makeFactory, makeInstance } from "./factory";
import { htmlToMarkdown } from "./markdown";

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
      let title: string | undefined;
      let markdown: string;
      try {
        ({ title, markdown } = htmlToMarkdown(result.bodyText));
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

export function activate(host: PluginHost): void {
  host.registerFactory("html2markdown", makeFactory(["fetch"], { fetch: createHtml2MarkdownFetch }));
}
