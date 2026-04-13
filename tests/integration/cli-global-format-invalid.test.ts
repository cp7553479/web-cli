import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli invalid -f format", () => {
  it("非零退出且 stderr 提示 Supported formats", () => {
    const r = runWeb(["-f", "xml", "search", "hello"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/format|Supported/i);
  });
});
