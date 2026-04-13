import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli 非法项目 .web/config.toml", () => {
  it("在临时 cwd 下合并损坏 overlay 时非零退出", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-badproj-"));
    const webDir = path.join(parent, ".web");
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, "config.toml"), "[[[[[not toml", "utf8");
    const r = runWeb(["search", "hello"], { cwd: parent });
    expect(r.status).not.toBe(0);
  });
});
