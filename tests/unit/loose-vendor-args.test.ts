import { describe, expect, it } from "vitest";

import { parseTrailingLooseVendorArgs } from "../../src/cli/loose-vendor-args";

describe("parseTrailingLooseVendorArgs", () => {
  it("空或仅位置参数", () => {
    expect(parseTrailingLooseVendorArgs(["hello"])).toEqual({});
  });

  it("--snake 与值", () => {
    expect(parseTrailingLooseVendorArgs(["hello", "--include_answer", "true"])).toEqual({
      include_answer: true,
    });
  });

  it("--kebab=value 归一为 snake", () => {
    expect(parseTrailingLooseVendorArgs(["q", "--include-answer=false"])).toEqual({
      include_answer: false,
    });
  });

  it("多键与无值布尔", () => {
    expect(parseTrailingLooseVendorArgs(["q", "--foo=3", "--bar"])).toEqual({ foo: 3, bar: true });
  });

  it("多 URL 后接 vendor 形参数", () => {
    expect(parseTrailingLooseVendorArgs(["u1", "u2", "--x", "y"])).toEqual({ x: "y" });
  });
});
