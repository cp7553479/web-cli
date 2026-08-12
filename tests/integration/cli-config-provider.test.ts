import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const tmpHomes: string[] = [];

function freshHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-it-"));
  tmpHomes.push(home);
  return home;
}

afterEach(() => {
  while (tmpHomes.length) fs.rmSync(tmpHomes.pop()!, { recursive: true, force: true });
});

describe("config lifecycle (isolated HOME)", () => {
  it("init writes config.json + .env, list shows empty groups", async () => {
    const home = freshHome();
    const init = await runWeb(["config", "init"], { HOME: home });
    expect(init.code).toBe(0);
    expect(fs.existsSync(path.join(home, ".web", "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(home, ".web", ".env"))).toBe(true);

    const list = await runWeb(["config", "list"], { HOME: home });
    expect(list.code).toBe(0);
    expect(list.stdout).toContain("[search]");
    expect(list.stdout).toContain("[fetch]");
    expect(list.stdout).toContain("(no accounts)");
  });

  it("set + list round-trips an account with a masked token", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    const set = await runWeb(
      ["config", "set", "search", "main", "--provider", "tavily", "--token", "tvly-secretkey123"],
      { HOME: home },
    );
    expect(set.code).toBe(0);
    const list = await runWeb(["config", "list"], { HOME: home });
    expect(list.stdout).toContain("main");
    expect(list.stdout).toContain("provider=tavily");
    expect(list.stdout).toContain("****");
    expect(list.stdout).not.toContain("tvly-secretkey123");
  });

  it("remove deletes an account", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "set", "fetch", "h", "--provider", "http"], { HOME: home });
    const before = await runWeb(["config", "list"], { HOME: home });
    expect(before.stdout).toContain("provider=http");
    await runWeb(["config", "remove", "fetch", "h"], { HOME: home });
    const after = await runWeb(["config", "list"], { HOME: home });
    expect(after.stdout).not.toContain("provider=http");
  });

  it("use writes current.json and rejects unknown alias", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "set", "search", "a", "--provider", "brave"], { HOME: home });
    const use = await runWeb(["config", "use", "search", "a"], { HOME: home });
    expect(use.code).toBe(0);
    const currentPath = path.join(home, ".web", "current.json");
    expect(JSON.parse(fs.readFileSync(currentPath, "utf8"))).toEqual({ search: "a" });
    const bad = await runWeb(["config", "use", "search", "nope"], { HOME: home });
    expect(bad.code).toBe(1);
    expect(bad.stderr).toMatch(/not found/);
  });

  it("doctor reports ok for a valid config + curl", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "set", "fetch", "h", "--provider", "http"], { HOME: home });
    const doc = await runWeb(["config", "doctor"], { HOME: home });
    expect(doc.code).toBe(0);
    expect(doc.stdout).toMatch(/config: ok/);
    expect(doc.stdout).toMatch(/curl: ok/);
    expect(doc.stdout).toContain("factory=ok");
  });
});

describe("provider list", () => {
  it("lists built-in providers with capabilities", async () => {
    const home = freshHome();
    const res = await runWeb(["provider", "list"], { HOME: home });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("tavily");
    expect(res.stdout).toContain("firecrawl");
    expect(res.stdout).toContain("[search,fetch]");
  });

  it("provider models for perplexity lists sonar variants", async () => {
    const home = freshHome();
    const res = await runWeb(["provider", "models", "perplexity"], { HOME: home });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("sonar-pro");
  });
});
