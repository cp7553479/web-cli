import { describe, expect, it } from "vitest";

import { webConfigSchema } from "../../src/config/schema";

function minimalWebConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    search: { account: {} },
    fetch: { account: {} },
    research: { account: {} },
    answer: { account: {} },
    ...overrides,
  };
}

describe("webConfigSchema enabled", () => {
  it("account 未写 enabled 时解析为 true", () => {
    const raw = minimalWebConfig({
      search: { account: { "t-main": { provider: "tavily", api_token: "{$TAVILY_API_KEY}" } } },
    });
    const r = webConfigSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.search.account["t-main"]?.enabled).toBe(true);
  });

  it("enabled = false 保持 false", () => {
    const raw = minimalWebConfig({
      fetch: { account: { "http-main": { provider: "http", enabled: false } } },
    });
    const r = webConfigSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.fetch.account["http-main"]?.enabled).toBe(false);
  });

  it("account 缺失时默认为空对象（不报错）", () => {
    // 模拟 TOML 中 [research] 段下没有任何子表 —— account 键完全不存在
    const raw = {
      search: { account: { "jina-main": { provider: "jina", enabled: true } } },
      fetch: { account: {} },
      research: {}, // account 缺失
      answer: {},   // account 缺失
    };
    const r = webConfigSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.research.account).toEqual({});
    expect(r.data.answer.account).toEqual({});
    expect(Object.keys(r.data.research.account)).toHaveLength(0);
  });
});
