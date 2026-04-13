import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli fetch smoke (http)", () => {
  it("exit 0", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const r = runWeb(["fetch", "http://example.com", "--provider", "http"], {
      env: { ...process.env, WEB_HOME: webHome },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.toLowerCase()).toMatch(/example|doctype|html/i);
  });
});
