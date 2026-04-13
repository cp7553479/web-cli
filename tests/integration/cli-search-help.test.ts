import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search --help", () => {
  it("exit 0", () => {
    const r = runWeb(["search", "--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/search/i);
  });
});
