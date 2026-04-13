import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search invalid --freshness", () => {
  it("非零退出", () => {
    const r = runWeb(["search", "x", "--freshness", "eon"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/freshness|Supported/i);
  });
});
