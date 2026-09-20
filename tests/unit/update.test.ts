import { describe, expect, it } from "vitest";

import { compareVersions } from "../../src/web/cli/commands/update";

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("2.0.2", "2.0.2")).toBe(0);
    expect(compareVersions("2.0.2", "2.1.0")).toBeLessThan(0);
    expect(compareVersions("2.1.0", "2.0.2")).toBeGreaterThan(0);
    expect(compareVersions("1.9.9", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("10.0.0", "9.99.99")).toBeGreaterThan(0);
  });

  it("treats missing segments as zero", () => {
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("2.0", "2.0.1")).toBeLessThan(0);
  });
});
