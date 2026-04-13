import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli answer --providers + --account 冲突", () => {
  it("非零退出", () => {
    const r = runWeb(["answer", "q", "--providers", "ddg-main", "brave-answer", "--account", "ddg-main"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/cannot be used together|Pick one/i);
  });
});
