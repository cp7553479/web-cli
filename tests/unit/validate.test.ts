import { describe, expect, it } from "vitest";

import { rejectConflict, requireOneOf, requirePositiveInt } from "../../src/cli/validate";

describe("validate", () => {
  it("requirePositiveInt 拒绝 0 与 NaN", () => {
    expect(() => requirePositiveInt(0, "--limit")).toThrow();
    expect(() => requirePositiveInt(Number.NaN, "--limit")).toThrow();
  });

  it("requireOneOf 拒绝未知枚举", () => {
    expect(() => requireOneOf("bad", ["a", "b"] as const, "--x")).toThrow(/Supported values/);
  });

  it("rejectConflict 同时设置时报错", () => {
    expect(() => rejectConflict("--a", true, "--b", true)).toThrow(/cannot be used together/);
  });
});
