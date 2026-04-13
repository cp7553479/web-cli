import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli onboard init", () => {
  it("在空 WEB_HOME 写入模板文件", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    const r = runWeb(["onboard", "init"], { env: { ...process.env, WEB_HOME: webHome } });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(webHome, "config.toml"))).toBe(true);
  });
});
