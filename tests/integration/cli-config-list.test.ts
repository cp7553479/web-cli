import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli config list", () => {
  it("exit 0 且输出 JSON（~/.web 与 ./.web 合并后）", () => {
    const r = runWeb(["config", "list"]);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout.trim());
    expect(j.search).toBeDefined();
    expect(j.fetch).toBeDefined();
  });
});
