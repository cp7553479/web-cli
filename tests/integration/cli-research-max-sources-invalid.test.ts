import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli research --max-sources 0", () => {
  it("非零退出", () => {
    const r = runWeb(["research", "x", "--max-sources", "0"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/max-sources|integer|positive/i);
  });
});
