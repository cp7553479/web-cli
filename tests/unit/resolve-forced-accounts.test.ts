import { describe, expect, it } from "vitest";

import { resolveForcedAccountOrder } from "../../src/config/resolve-accounts";
import type { GroupConfig } from "../../src/config/types";
import { AppError } from "../../src/core/errors";

function group(accounts: Record<string, { provider: string }>): GroupConfig {
  return { account: accounts };
}

describe("resolveForcedAccountOrder", () => {
  it("无 vendor、无 account：按声明顺序返回全部 id", () => {
    const g = group({
      b: { provider: "tavily" },
      a: { provider: "tavily" },
    });
    expect(resolveForcedAccountOrder(g, "search", {})).toEqual(["b", "a"]);
  });

  it("仅 vendor：同厂商多条时保留全表声明顺序子序列", () => {
    const g = group({
      z: { provider: "jina" },
      t1: { provider: "tavily" },
      j: { provider: "jina" },
      t2: { provider: "tavily" },
    });
    expect(resolveForcedAccountOrder(g, "search", { vendorOrAlias: "tavily" })).toEqual(["t1", "t2"]);
    expect(resolveForcedAccountOrder(g, "search", { vendorOrAlias: "jina" })).toEqual(["z", "j"]);
  });

  it("vendor 与某账号 id 同名：优先单条该 id（即使其 provider 不同）", () => {
    const g = group({
      tavily: { provider: "jina" },
      t1: { provider: "tavily" },
    });
    expect(resolveForcedAccountOrder(g, "search", { vendorOrAlias: "tavily" })).toEqual(["tavily"]);
  });

  it("仅 account：返回单条", () => {
    const g = group({ x: { provider: "brave" } });
    expect(resolveForcedAccountOrder(g, "search", { accountId: "x" })).toEqual(["x"]);
  });

  it("vendor + account：一致则单条；不一致则 ACCOUNT_PROVIDER_MISMATCH", () => {
    const g = group({ x: { provider: "brave" } });
    expect(resolveForcedAccountOrder(g, "search", { vendorOrAlias: "brave", accountId: "x" })).toEqual(["x"]);
    expect(() =>
      resolveForcedAccountOrder(g, "search", { vendorOrAlias: "tavily", accountId: "x" }),
    ).toThrow(AppError);
    try {
      resolveForcedAccountOrder(g, "search", { vendorOrAlias: "tavily", accountId: "x" });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("ACCOUNT_PROVIDER_MISMATCH");
    }
  });

  it("不存在的 account：CONFIG_MODEL_NOT_FOUND", () => {
    const g = group({ x: { provider: "brave" } });
    expect(() => resolveForcedAccountOrder(g, "fetch", { accountId: "nope" })).toThrow(AppError);
    try {
      resolveForcedAccountOrder(g, "fetch", { accountId: "nope" });
    } catch (e) {
      expect((e as AppError).code).toBe("CONFIG_MODEL_NOT_FOUND");
    }
  });

  it("不存在的厂商且无同名 id：PROVIDER_NOT_FOUND", () => {
    const g = group({ x: { provider: "brave" } });
    expect(() => resolveForcedAccountOrder(g, "answer", { vendorOrAlias: "tavily" })).toThrow(AppError);
    try {
      resolveForcedAccountOrder(g, "answer", { vendorOrAlias: "tavily" });
    } catch (e) {
      expect((e as AppError).code).toBe("PROVIDER_NOT_FOUND");
    }
  });
});
