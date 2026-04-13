import { describe, expect, it } from "vitest";

import { toGlobalFlags } from "../../src/cli/global";

describe("toGlobalFlags — 零值拒绝", () => {
  it("--max-length 0 抛错", () => {
    expect(() => toGlobalFlags({ maxLength: 0 })).toThrow(/Invalid value/);
  });

  it("--timeout-ms 0 抛错", () => {
    expect(() => toGlobalFlags({ timeoutMs: 0 })).toThrow(/Invalid value/);
  });

  it("--max-length 1 不抛错", () => {
    const flags = toGlobalFlags({ maxLength: 1 });
    expect(flags.maxLength).toBe(1);
  });
});
