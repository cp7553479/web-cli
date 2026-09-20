import { describe, expect, it } from "vitest";

import { htmlToMarkdown } from "../../src/web/plugins/builtin/markdown";

describe("htmlToMarkdown", () => {
  it("extracts the readable article and converts to markdown", () => {
    const { title, markdown } = htmlToMarkdown(
      `<html><head><title>Page</title></head><body>
        <article><h1>Heading</h1><p>Some <b>bold</b> text and a <a href="https://x">link</a>.</p></article>
      </body></html>`,
    );
    expect(title).toBe("Page");
    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("[link](https://x)");
    expect(markdown).not.toContain("<script");
  });

  it("falls back to text content when no article is found", () => {
    const { markdown } = htmlToMarkdown("<html><body><p>plain words</p></body></html>");
    expect(markdown).toContain("plain words");
  });
});
