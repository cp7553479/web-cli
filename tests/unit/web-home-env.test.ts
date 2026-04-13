import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getConfigPaths } from "../../src/config";

describe("WEB_HOME", () => {
  afterEach(() => {
    delete process.env.WEB_HOME;
  });

  it("未设置时使用 ~/.web", () => {
    delete process.env.WEB_HOME;
    expect(getConfigPaths().rootDir).toBe(path.join(os.homedir(), ".web"));
  });

  it("设置时 rootDir 为绝对路径", () => {
    process.env.WEB_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-wh-"));
    expect(getConfigPaths().rootDir).toBe(path.resolve(process.env.WEB_HOME));
  });
});
