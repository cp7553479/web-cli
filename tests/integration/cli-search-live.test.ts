import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search 真实网络调用", () => {
  it("tavily search 返回结果（依赖配置好的 tavily API key）", () => {
    const r = runWeb(["--max-length", "20000000", "search", "hello world", "--limit", "2", "-f", "json"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0]).toHaveProperty("title");
    expect(parsed.items[0]).toHaveProperty("url");
  }, 30000);

  it("jina search 返回结果（依赖配置好的 jina API key）", () => {
    const r = runWeb(["search", "nodejs", "--limit", "2", "--provider", "jina"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/nodejs|node\.js|Node/i);
    expect(r.stdout.length).toBeGreaterThan(50);
  }, 30000);

  it("多 provider 并发搜索合并结果", () => {
    const r = runWeb(["search", "typescript", "--limit", "2", "--providers", "tavily", "jina"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/typescript/i);
    expect(r.stdout.length).toBeGreaterThan(100);
  }, 60000);
});
