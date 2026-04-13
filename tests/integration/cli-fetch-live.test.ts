import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli fetch 真实网络调用", () => {
  it("jina-reader fetch 单 URL 正常返回", () => {
    const r = runWeb(["fetch", "https://example.com", "--provider", "jina", "-f", "json"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0].url).toBe("https://example.com");
  }, 30000);

  it("html2markdown fetch 单 URL 正常返回", () => {
    const r = runWeb(["fetch", "https://example.com", "--provider", "html2markdown", "-f", "json"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].content.length).toBeGreaterThan(10);
  }, 30000);

  it("html2markdown 多 URL 其中一个不存在，不整批失败", () => {
    const r = runWeb([
      "fetch",
      "https://example.com",
      "https://this-domain-does-not-exist-999.test",
      "--provider", "html2markdown",
      "-f", "json",
    ]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.items.length).toBe(2);
    const ok = parsed.items.find((i: any) => i.url === "https://example.com");
    const fail = parsed.items.find((i: any) => i.url === "https://this-domain-does-not-exist-999.test");
    expect(ok.content.length).toBeGreaterThan(10);
    expect(fail.content).toMatch(/Error/i);
  }, 30000);
});
