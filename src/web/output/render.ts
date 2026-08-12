import { injectWrap, stringifyJson, truncate } from "../../core";
import type { ProviderResponse } from "../protocol/types";
import type { OutputFormat } from "../cli/global-flags";

/**
 * Renders a {@link ProviderResponse} in the requested format, wraps it with the
 * segment's `inject_before`/`inject_after`, and hard-truncates to `maxLength`.
 * Uses core output primitives; the per-item mapping is the only web-specific
 * part (json/markdown/text layouts of `{title,url,snippet,content}`).
 */
export function render(
  response: ProviderResponse,
  format: OutputFormat,
  maxLength: number,
  injectBefore?: string,
  injectAfter?: string,
): string {
  const body = format === "json"
    ? renderJson(response)
    : format === "markdown"
      ? renderMarkdown(response)
      : renderText(response);
  return truncate(injectWrap(body, injectBefore, injectAfter), maxLength);
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
