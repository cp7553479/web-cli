import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli answer smoke (ddg)", () => {
  it("exit 0 且有输出（依赖仓库 ./.web 与 ~/.web 合并配置）", () => {
    const r = runWeb(["answer", "typescript", "--provider", "duckduckgo"]);
    expect(r.status).toBe(0);
    expect((r.stdout + r.stderr).length).toBeGreaterThan(0);
  });
});
