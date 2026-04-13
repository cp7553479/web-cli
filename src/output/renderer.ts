import type { OutputFormat, ProviderResponse } from "../core/types";

export function render(
  response: ProviderResponse,
  format: OutputFormat,
  maxLength: number,
  injectBefore?: string,
  injectAfter?: string,
): string {
  let body: string;
  switch (format) {
    case "json":
      body = renderJson(response);
      break;
    case "markdown":
      body = renderMarkdown(response);
      break;
    case "text":
    default:
      body = renderText(response);
      break;
  }
  const parts: string[] = [];
  if (injectBefore) parts.push(injectBefore);
  parts.push(body);
  if (injectAfter) parts.push(injectAfter);
  return cut(parts.join("\n"), maxLength);
}

function renderJson(response: ProviderResponse): string {
  const o: Record<string, unknown> = { items: response.items };
  if (response.raw !== undefined) o.raw = response.raw;
  return JSON.stringify(o, null, 2);
}

function renderText(response: ProviderResponse): string {
  const lines: string[] = [];
  response.items.forEach((item, idx) => {
    lines.push(`\n[${idx + 1}] ${item.title ?? "(no title)"}`);
    if (item.url) lines.push(`url: ${item.url}`);
    if (item.snippet) lines.push(`snippet: ${item.snippet}`);
    if (item.content) lines.push(`content: ${item.content}`);
  });
  return lines.join("\n").replace(/^\n/, "");
}

function renderMarkdown(response: ProviderResponse): string {
  const lines: string[] = [];
  response.items.forEach((item, idx) => {
    lines.push(`\n## ${idx + 1}. ${item.title ?? "(no title)"}`);
    if (item.url) lines.push(`- URL: ${item.url}`);
    if (item.snippet) lines.push(`- Snippet: ${item.snippet}`);
    if (item.content) lines.push(`\n${item.content}`);
  });
  return lines.join("\n").replace(/^\n/, "");
}

function cut(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}\n...[truncated]`;
}

