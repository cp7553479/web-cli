import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli plugins list 损坏的 web-plugin.json", () => {
  it("非零退出（JSON.parse 未捕获）", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const dir = path.join(webHome, "plugins", "bad");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "web-plugin.json"), "{", "utf8");
    const r = runWeb(["plugins", "list"], { env: { ...process.env, WEB_HOME: webHome } });
    expect(r.status).not.toBe(0);
  });
});
