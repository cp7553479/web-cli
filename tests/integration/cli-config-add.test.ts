import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const tmpHomes: string[] = [];

function freshHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-add-"));
  tmpHomes.push(home);
  return home;
}

afterEach(() => {
  while (tmpHomes.length) fs.rmSync(tmpHomes.pop()!, { recursive: true, force: true });
});

function readConfig(home: string): { search: { account: Record<string, Record<string, unknown>> } } {
  return JSON.parse(fs.readFileSync(path.join(home, ".web", "config.json"), "utf8"));
}

describe("web config add (schema-driven)", () => {
  it("writes the provider + seeded schema fields into the account", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });

    const res = await runWeb(
      [
        "config", "add", "search", "main",
        "--provider", "tavily",
        "--token", "{$TAVILY_KEY}",
        "--field", "base_url=https://api.tavily.com",
      ],
      { HOME: home },
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/added \[search\.account\.main\] provider=tavily/);
    const account = readConfig(home).search.account.main!;
    expect(account.provider).toBe("tavily");
    expect(account.api_token).toBe("{$TAVILY_KEY}");
    expect(account.base_url).toBe("https://api.tavily.com");
  });

  it("omits unseeded fields (non-interactive add stays minimal)", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    const res = await runWeb(["config", "add", "fetch", "raw", "--provider", "http"], { HOME: home });
    expect(res.code).toBe(0);
    const account = readConfig(home).search.account ?? {};
    const raw = (readConfig(home).fetch.account).raw!;
    expect(raw.provider).toBe("http");
    expect(Object.keys(raw)).toEqual(["provider"]);
    void account;
  });

  it("rejects unknown providers and capability mismatches", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    const unknown = await runWeb(["config", "add", "search", "x", "--provider", "nope"], { HOME: home });
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toMatch(/Unknown provider 'nope'/);

    const mismatch = await runWeb(["config", "add", "fetch", "x", "--provider", "brave"], { HOME: home });
    expect(mismatch.code).toBe(1);
    expect(mismatch.stderr).toMatch(/does not support 'fetch'/);
  });

  it("preserves schema fields through validation and round-trips config show", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "add", "fetch", "e", "--provider", "http", "--field", "base_url=https://e.example"], { HOME: home });
    const cfgPath = path.join(home, ".web", "config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    cfg.fetch.account.e.model = "reader-v2";
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");

    const show = await runWeb(["config", "show", "--json"], { HOME: home });
    expect(show.code).toBe(0);
    const shown = JSON.parse(show.stdout);
    expect(shown.fetch.account.e.model).toBe("reader-v2");
  });
});
