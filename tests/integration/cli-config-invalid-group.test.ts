import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli config set 非法 group", () => {
  it("非零退出", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const r = runWeb(["config", "set", "not-a-group", "x", "--provider", "tavily"], {
      env: { ...process.env, WEB_HOME: webHome },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Invalid group|search|fetch/i);
  });
});
