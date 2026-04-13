import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli --max-length 0 和 --timeout-ms 0 拒绝", () => {
  it("--max-length 0 应报错退出", () => {
    const r = runWeb(["search", "test", "--max-length", "0"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Invalid value.*max-length|positive/i);
  });

  it("--timeout-ms 0 应报错退出", () => {
    const r = runWeb(["search", "test", "--timeout-ms", "0"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Invalid value.*timeout|positive/i);
  });
});
