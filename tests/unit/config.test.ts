import { describe, expect, it } from "vitest";

import { removeModel, resolveGroupOrder, setModel } from "../../src/config";
import { defaultConfig } from "../../src/config/defaults";

describe("config helpers", () => {
  it("resolveGroupOrder 按 account 声明顺序", () => {
    const cfg = defaultConfig();
    cfg.search.account = {
      a: { provider: "tavily" },
      b: { provider: "brave" },
    };
    expect(resolveGroupOrder(cfg.search)).toEqual(["a", "b"]);
  });

  it("setModel + removeModel 正常工作", () => {
    let cfg = defaultConfig();
    cfg = setModel(cfg, "search", "kimi-1", {
      provider: "kimi",
      api_token: "{$MOONSHOT_API_KEY}",
    });
    expect(cfg.search.account["kimi-1"]?.provider).toBe("kimi");

    cfg = removeModel(cfg, "search", "kimi-1");
    expect(cfg.search.account["kimi-1"]).toBeUndefined();
  });
});
