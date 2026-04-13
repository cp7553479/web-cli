import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli answer 真实网络调用", () => {
  it("duckduckgo instant answer 返回结果", () => {
    const r = runWeb(["answer", "Albert Einstein", "--provider", "duckduckgo", "-f", "json", "--max-length", "50000"]);
    if (r.status !== 0) {
      console.log("stderr:", r.stderr);
      console.log("stdout:", r.stdout);
    }
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0].title || parsed.items[0].content).toBeTruthy();
  }, 30000);
});
