import { describe, expect, it } from "vitest";

import { parseVendorPairs, pickWhitelisted } from "../../src/providers/vendor-params";

describe("pickWhitelisted", () => {
  it("只保留白名单键", () => {
    const allow = new Set(["a", "b"]);
    expect(pickWhitelisted({ a: 1, c: 2, b: 3 }, allow)).toEqual({ a: 1, b: 3 });
  });

  it("undefined 返回空对象", () => {
    expect(pickWhitelisted(undefined, new Set(["x"]))).toEqual({});
  });
});

describe("parseVendorPairs", () => {
  it("解析 boolean 与 number", () => {
    expect(parseVendorPairs(["include_answer=true", "max_results=3"])).toEqual({
      include_answer: true,
      max_results: 3,
    });
  });

  it("无效行跳过", () => {
    expect(parseVendorPairs(["nope", "k=v"])).toEqual({ k: "v" });
  });
});
