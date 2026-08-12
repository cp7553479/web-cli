import { describe, expect, it } from "vitest";

import { toGlobalFlags } from "../../src/web/cli/global-flags";
import {
  buildFetchRequest,
  buildSearchRequest,
  rejectConflict,
  requireOneOf,
  requirePositiveInt,
} from "../../src/web/protocol/requests";

describe("toGlobalFlags", () => {
  it("applies defaults", () => {
    const f = toGlobalFlags({});
    expect(f).toEqual({ format: "text", maxLength: 10000, timeoutMs: 15000 });
  });

  it("rejects invalid format", () => {
    expect(() => toGlobalFlags({ format: "yaml" })).toThrow(/Invalid format/);
  });

  it("rejects non-positive length/timeout", () => {
    expect(() => toGlobalFlags({ maxLength: "0" })).toThrow();
    expect(() => toGlobalFlags({ maxLength: "-3" })).toThrow();
    expect(() => toGlobalFlags({ timeoutMs: "abc" })).toThrow();
  });
});

describe("requirePositiveInt / requireOneOf / rejectConflict", () => {
  it("requirePositiveInt falls back when absent", () => {
    expect(requirePositiveInt(undefined, "--n", 5)).toBe(5);
  });
  it("requireOneOf throws on bad value", () => {
    expect(() => requireOneOf("bad", ["a", "b"] as const, "--x")).toThrow(/Expected one of/);
  });
  it("rejectConflict throws when both set", () => {
    expect(() => rejectConflict("--a", true, "--b", true)).toThrow(/cannot be used together/);
    expect(() => rejectConflict("--a", false, "--b", true)).not.toThrow();
  });
});

describe("buildSearchRequest", () => {
  it("merges site/sites and validates freshness", () => {
    const r = buildSearchRequest({ query: "q", limit: 5, site: ["a.com"], sites: ["b.com"], freshness: "week" });
    expect(r.site).toEqual(["a.com", "b.com"]);
    expect(r.freshness).toBe("week");
  });
  it("drops empty vendorParams", () => {
    expect(buildSearchRequest({ query: "q", limit: 5 }).vendorParams).toBeUndefined();
  });
  it("rejects invalid freshness", () => {
    expect(() => buildSearchRequest({ query: "q", limit: 5, freshness: "decade" })).toThrow();
  });
});

describe("buildFetchRequest", () => {
  it("validates waitUntil", () => {
    expect(buildFetchRequest({ urls: ["https://x"] }).waitUntil).toBeUndefined();
    expect(buildFetchRequest({ urls: ["https://x"], waitUntil: "load" }).waitUntil).toBe("load");
    expect(() => buildFetchRequest({ urls: ["https://x"], waitUntil: "forever" })).toThrow();
  });
});
