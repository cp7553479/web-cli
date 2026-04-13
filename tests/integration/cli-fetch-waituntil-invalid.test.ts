import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli fetch invalid --wait-until", () => {
  it("非零退出", () => {
    const r = runWeb(["fetch", "https://example.com", "--wait-until", "never"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/wait-until|Supported/i);
  });
});
