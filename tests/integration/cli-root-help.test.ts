import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli root --help", () => {
  it("exit 0 且包含 web 用法", () => {
    const r = runWeb(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/web/i);
  });
});
