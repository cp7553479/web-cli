import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli config list", () => {
  it("exit 0 且输出 JSON", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const r = runWeb(["config", "list"], { env: { ...process.env, WEB_HOME: webHome } });
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout.trim());
    expect(j.search).toBeDefined();
    expect(j.fetch).toBeDefined();
  });
});
