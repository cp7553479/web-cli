import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli answer smoke (ddg)", () => {
  it("exit 0 且有输出", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const r = runWeb(["answer", "typescript", "--provider", "duckduckgo"], {
      env: { ...process.env, WEB_HOME: webHome },
    });
    expect(r.status).toBe(0);
    expect((r.stdout + r.stderr).length).toBeGreaterThan(0);
  });
});
