import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";
import { writeFetchHttpOnlyWebHome } from "../helpers/minimal-web-home";

describe("cli plugins list 空目录", () => {
  it("exit 0 且提示 empty", () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    writeFetchHttpOnlyWebHome(webHome);
    const plugins = path.join(webHome, "plugins");
    fs.mkdirSync(plugins, { recursive: true });
    const r = runWeb(["plugins", "list"], { env: { ...process.env, WEB_HOME: webHome } });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\(no manifests\)|\(empty\)/);
  });
});
