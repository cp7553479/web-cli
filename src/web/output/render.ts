import { injectWrap, stringifyJson } from "../../core";
import type { ProviderResponse } from "../protocol/types";
import type { OutputFormat } from "../cli/global-flags";

/**
 * Renders an image-search {@link ProviderResponse}. Items carry the image URL
 * in `url`; markdown emits `![](url)` embeds, text emits plain URL lines.
 */
export function renderImages(
  response: ProviderResponse,
  format: OutputFormat,
  injectBefore?: string,
  injectAfter?: string,
): string {
  const body = format === "json"
    ? stringifyJson({ items: response.items })
    : format === "markdown"
      ? response.items.map((item) => {
          const alt = item.title ?? item.url ?? "image";
          const lines = [`![${alt}](${item.url ?? ""})`];
          if (item.snippet) lines.push(`- ${item.snippet}${item.content ? ` — ${item.content}` : ""}`);
          return lines.join("\n");
        }).join("\n\n")
      : response.items.map((item, idx) => {
          const lines = [`[${idx + 1}] ${item.title ?? "(no title)"}`];
          if (item.url) lines.push(`url: ${item.url}`);
          if (item.snippet) lines.push(`source: ${item.snippet}`);
          return lines.join("\n");
        }).join("\n\n");
  return injectWrap(body, injectBefore, injectAfter);
}

/**
 * Renders a {@link ProviderResponse} in the requested format, wrapped with the
 * segment's `inject_before`/`inject_after`. Returns the FULL output — callers
 * decide truncation/spill (see `emitResult`). The per-item mapping is the only
 * web-specific part (json/markdown/text layouts of `{title,url,snippet,content}`).
 */
export function render(
  response: ProviderResponse,
  format: OutputFormat,
  injectBefore?: string,
  injectAfter?: string,
): string {
  const body = format === "json"
    ? renderJson(response)
    : format === "markdown"
      ? renderMarkdown(response)
      : renderText(response);
  return injectWrap(body, injectBefore, injectAfter);
}

function renderJson(response: ProviderResponse): string {
  const value: Record<string, unknown> = { items: response.items };
  if (response.raw !== undefined) value.raw = response.raw;
  return stringifyJson(value);
}

function renderText(response: ProviderResponse): string {
  const lines: string[] = [];
  response.items.forEach((item, idx) => {
    lines.push(`[${idx + 1}] ${item.title ?? "(no title)"}`);
    if (item.url) lines.push(`url: ${item.url}`);
    if (item.snippet) lines.push(`snippet: ${item.snippet}`);
    if (item.content) lines.push(item.content);
  });
  return lines.join("\n");
}

function renderMarkdown(response: ProviderResponse): string {
  const lines: string[] = [];
  response.items.forEach((item, idx) => {
    lines.push(`## ${idx + 1}. ${item.title ?? "(no title)"}`);
    if (item.url) lines.push(`- URL: ${item.url}`);
    if (item.snippet) lines.push(`- Snippet: ${item.snippet}`);
    if (item.content) lines.push("", item.content);
  });
  return lines.join("\n");
}
