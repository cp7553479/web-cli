import { describe, expect, it } from "vitest";

import { render } from "../../src/output/renderer";
import type { ProviderResponse } from "../../src/core/types";

function makeResponse(overrides?: Partial<ProviderResponse>): ProviderResponse {
  return {
    provider: "test",
    items: [{ title: "Hello", url: "https://example.com", content: "body text", source: "test" }],
    ...overrides,
  };
}

describe("renderer", () => {
  it("text 格式正常渲染", () => {
    const out = render(makeResponse(), "text", 10000);
    expect(out).toContain("Hello");
    expect(out).toContain("https://example.com");
    expect(out).toContain("body text");
  });

  it("json 格式输出可解析的 JSON", () => {
    const out = render(makeResponse(), "json", 10000);
    const parsed = JSON.parse(out);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].title).toBe("Hello");
  });

  it("markdown 格式包含标题", () => {
    const out = render(makeResponse(), "markdown", 10000);
    expect(out).toContain("## 1. Hello");
  });

  it("maxLength 截断输出并追加 truncated 标记", () => {
    const out = render(makeResponse(), "text", 10);
    expect(out).toContain("...[truncated]");
    expect(out.indexOf("...[truncated]")).toBeLessThan(30);
  });

  it("cut() 不截断多字节字符（emoji surrogate pair）", () => {
    const emoji = "🎉";
    const resp = makeResponse({ items: [{ title: emoji.repeat(50), content: "", source: "t" }] });
    const out = render(resp, "text", 20);
    expect(out).toContain("...[truncated]");
    const beforeTrunc = out.split("\n...[truncated]")[0];
    expect(beforeTrunc.isWellFormed()).toBe(true);
    const encoded = new TextEncoder().encode(beforeTrunc);
    const decoded = new TextDecoder().decode(encoded);
    expect(decoded).toBe(beforeTrunc);
  });

  it("injectBefore / injectAfter 注入内容", () => {
    const out = render(makeResponse(), "text", 10000, "<<BEFORE>>", "<<AFTER>>");
    expect(out).toContain("<<BEFORE>>");
    expect(out).toContain("<<AFTER>>");
    expect(out.indexOf("<<BEFORE>>")).toBeLessThan(out.indexOf("Hello"));
    expect(out.indexOf("<<AFTER>>")).toBeGreaterThan(out.indexOf("Hello"));
  });
});
