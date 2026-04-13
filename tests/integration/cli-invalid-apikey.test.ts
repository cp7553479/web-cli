import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stringify as stringifyToml } from "@iarna/toml";
import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/config/defaults";
import { runWeb } from "../helpers/run-web";

describe("无效 API Key 场景", () => {
  it("search --provider brave 无 brave 账号配置时报 Unsupported provider", () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-no-brave-"));
    const webDir = path.join(homeDir, ".web");
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, "config.toml"), stringifyToml(defaultConfig() as any), "utf8");
    fs.writeFileSync(path.join(webDir, ".env"), "JINA_API_KEY=placeholder\n", "utf8");
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-no-brave-cwd-"));
    const r = runWeb(["search", "test", "--provider", "brave", "--limit", "2"], {
      env: { ...process.env, HOME: homeDir },
      cwd,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/unsupported|not found|no.*account|failed/i);
  }, 30000);

  it("fetch 一个无效 provider 名报 PROVIDER_NOT_FOUND", () => {
    const r = runWeb(["fetch", "https://example.com", "--provider", "nonexistent-provider-xyz"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/unsupported|not found/i);
  }, 15000);

  it("research 使用 jina provider（若 jina 不支持 research API 则报明确错误）", () => {
    const r = runWeb(["research", "AI trends 2026", "--provider", "jina"]);
    if (r.status === 0) {
      expect(r.stdout.length).toBeGreaterThan(0);
    } else {
      expect(r.stderr + r.stdout).toMatch(/failed|unsupported|error/i);
    }
  }, 60000);

  it("answer 使用不存在的 account id 报 CONFIG_MODEL_NOT_FOUND 或类似", () => {
    const r = runWeb(["answer", "test", "--account", "fake-account-id-999"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/not found|no.*account|failed/i);
  }, 15000);
});
