/**
 * Output primitives shared by domain renderers. Core deliberately does NOT know
 * how to render domain items (e.g. `{title,url,snippet}`); it only provides the
 * mechanical helpers: truncation, inject-wrapping, and JSON serialisation.
 */

/**
 * Hard-truncates `input` to `maxLength` code points, appending `...[truncated]`
 * only when truncation occurs. Returns input unchanged when it fits.
 */
export function truncate(input: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (input.length <= maxLength) return input;
  const safe = Array.from(input).slice(0, maxLength).join("");
  return `${safe}\n...[truncated]`;
}

/** Wraps `body` between optional `before` / `after` snippets, joined by `\n`. */
export function injectWrap(body: string, before?: string, after?: string): string {
  const parts: string[] = [];
  if (before) parts.push(before);
  parts.push(body);
  if (after) parts.push(after);
  return parts.join("\n");
}

/** Stable pretty JSON serialisation; never throws (falls back to String). */
export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
