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
});
