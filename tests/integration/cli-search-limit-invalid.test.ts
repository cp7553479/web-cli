import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search --limit 0", () => {
  it("非零退出", () => {
    const r = runWeb(["search", "x", "--limit", "0"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/limit|integer|positive/i);
  });
});
