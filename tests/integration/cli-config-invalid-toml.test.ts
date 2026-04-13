import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli 非法 config.toml", () => {
  it("search 触发解析或校验失败且非零退出", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    fs.mkdirSync(webHome, { recursive: true });
    fs.writeFileSync(path.join(webHome, "config.toml"), "[[[[[not toml", "utf8");
    fs.writeFileSync(path.join(webHome, ".env"), "", "utf8");
    const r = runWeb(["search", "hello"], { env: { ...process.env, WEB_HOME: webHome } });
    expect(r.status).not.toBe(0);
  });
});
