import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli config set 非法 group", () => {
  it("非零退出", () => {
    const r = runWeb(["config", "set", "not-a-group", "x", "--provider", "tavily"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Invalid group|search|fetch/i);
  });
});
