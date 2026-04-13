import { describe, expect, it } from "vitest";

import { toGlobalFlags } from "../../src/cli/global";

describe("toGlobalFlags", () => {
  it("非法 format 抛错", () => {
    expect(() => toGlobalFlags({ format: "xml" })).toThrow(/Invalid format/);
  });

  it("负数 --max-length 抛错", () => {
    expect(() => toGlobalFlags({ maxLength: -1 })).toThrow(/Invalid value/);
  });

  it("非数字 --timeout-ms 抛错", () => {
    expect(() => toGlobalFlags({ timeoutMs: "x" })).toThrow(/Invalid value/);
  });
});
