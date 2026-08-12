import { describe, expect, it } from "vitest";

import { filterVendorParams, parseLooseVendor, parseVendorPairs } from "../../src/web/protocol/vendor-params";

describe("parseVendorPairs", () => {
  it("parses key=value pairs", () => {
    expect(parseVendorPairs(["a=1", "b=two"])).toEqual({ a: 1, b: "two" });
  });

  it("coerces booleans and integers", () => {
    expect(parseVendorPairs(["x=true", "y=false", "n=42", "neg=-7"])).toEqual({
      x: true,
      y: false,
      n: 42,
      neg: -7,
    });
  });

  it("preserves = inside values", () => {
    expect(parseVendorPairs(["q=a=b=c"])).toEqual({ q: "a=b=c" });
  });

  it("throws on malformed entries", () => {
    expect(() => parseVendorPairs(["nope"])).toThrow();
    expect(() => parseVendorPairs(["=val"])).toThrow();
  });

  it("returns empty for undefined/empty input", () => {
    expect(parseVendorPairs(undefined)).toEqual({});
    expect(parseVendorPairs([])).toEqual({});
  });
});

describe("parseLooseVendor", () => {
  const known = new Set(["format", "limit"]);

  it("extracts --key=value not in known set", () => {
    expect(parseLooseVendor(["--include_answer=true", "--format", "json"], known)).toEqual({
      include_answer: true,
    });
  });

  it("extracts --key value form", () => {
    expect(parseLooseVendor(["--topic", "news", "positional"], known)).toEqual({ topic: "news" });
  });

  it("ignores known flags and bare positionals", () => {
    expect(parseLooseVendor(["--limit", "5", "query"], known)).toEqual({});
  });

  it("treats a lone unknown flag as boolean true", () => {
    expect(parseLooseVendor(["--flag"], known)).toEqual({ flag: true });
  });
});

describe("filterVendorParams", () => {
  it("keeps only allowlisted keys", () => {
    expect(filterVendorParams({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("returns undefined when nothing matches", () => {
    expect(filterVendorParams({ x: 1 }, ["a"])).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(filterVendorParams(undefined, ["a"])).toBeUndefined();
  });
});
