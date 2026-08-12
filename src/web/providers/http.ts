import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../core";
import type { FetchRequest, ProviderResponse } from "../protocol/types";
import { makeInstance } from "./_factory";

/**
 * Raw HTTP fetch: a plain `curl GET` of the target URL, body returned as-is.
 * No status-based failover (a given URL resolves identically for every http
 * account), so non-2xx bodies are still returned with a status note.
 */
export function createHttpFetch(binding: ProviderBinding) {
  const hooks: ProviderHooks<FetchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      return {
        method: "GET",
        url: req.urls[0],
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebCLI/1.0)" },
      };
    },
    parseResponse(result, req): ProviderResponse {
      const body = result.bodyText;
      const title = extractTitle(body);
      const note = result.statusCode >= 400 ? ` (HTTP ${result.statusCode})` : "";
      return {
        provider: binding.alias,
        items: [{ title: title ?? req.urls[0], url: req.urls[0], content: body ? `${body}${note ? `\n\n[${note.trim()}]` : ""}` : `(empty body${note})`, source: "http" }],
      };
    },
  };
  return makeInstance(binding, hooks);
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : undefined;
}
