import { describe, expect, it } from "vitest";

import { deepMergeWebTomlLayer, deepStripTomlSymbols } from "../../src/config";

describe("deepStripTomlSymbols", () => {
  it("去掉 Symbol 键", () => {
    const sym = Symbol("x");
    const input = { search: { account: { a: { provider: "tavily" } }, [sym]: 1 } };
    const out = deepStripTomlSymbols(input) as Record<string, unknown>;
    expect(Object.getOwnPropertySymbols(out).length).toBe(0);
    expect((out.search as Record<string, unknown>).account).toBeDefined();
  });
});

describe("deepMergeWebTomlLayer", () => {
  it("项目 account 与全局 account 合并", () => {
    const global = {
      search: {
        account: { a: { provider: "tavily" }, b: { provider: "brave" } },
      },
    };
    const project = {
      search: {
        account: { c: { provider: "kimi" } },
      },
    };
    const m = deepMergeWebTomlLayer(global, project) as Record<string, Record<string, unknown>>;
    expect(Object.keys(m.search.account as object)).toEqual(["a", "b", "c"]);
  });

  it("项目覆盖同名 account", () => {
    const global = {
      search: { account: { a: { provider: "tavily" } } },
    };
    const project = {
      search: { account: {} },
    };
    const m = deepMergeWebTomlLayer(global, project) as Record<string, Record<string, unknown>>;
    expect(m.search.account).toEqual({ a: { provider: "tavily" } });
  });
});
