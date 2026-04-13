import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search --provider + --providers 冲突", () => {
  it("非零退出", () => {
    const r = runWeb(["search", "q", "--provider", "jina", "--providers", "jina", "tavily"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/cannot be used together|Pick one/i);
  });
});
