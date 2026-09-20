/**
 * Shared HTML → readable-Markdown pipeline (Mozilla Readability + turndown,
 * vendored). Used by the html2markdown and playwright plugins so both emit
 * the same cleaned output.
 */
export function htmlToMarkdown(html: string): { title?: string; markdown: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Readability = require("../../../vendor/Readability");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TurndownService = require("../../../vendor/turndown");
  const document = parseDocument(html);
  const article = new Readability(document).parse();
  const title = article?.title;
  if (article?.content) {
    const contentDoc = parseDocument(article.content);
    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    return { title, markdown: turndown.turndown(contentDoc.documentElement) };
  }
  return { title, markdown: article?.textContent ?? html };
}

function parseDocument(html: string): Record<string, unknown> {
  // linkedom is the one admitted DOM dependency for this pipeline.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseHTML } = require("linkedom");
  return parseHTML(html).document;
}
