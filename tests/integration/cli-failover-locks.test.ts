import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const tmpHomes: string[] = [];

function freshHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-lock-"));
  tmpHomes.push(home);
  return home;
}

afterEach(() => {
  while (tmpHomes.length) fs.rmSync(tmpHomes.pop()!, { recursive: true, force: true });
});

describe("account lock persistence (dead endpoints, offline)", () => {
  it("locks failed accounts to locks.json and re-reads them on the next run", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(
      ["config", "set", "search", "a", "--provider", "brave", "--base-url", "http://127.0.0.1:9"],
      { HOME: home },
    );
    await runWeb(
      ["config", "set", "search", "b", "--provider", "tavily", "--base-url", "http://127.0.0.1:9"],
      { HOME: home },
    );

    const first = await runWeb(["search", "q"], { HOME: home });
    expect(first.code).toBe(1);
    expect(first.stderr).toMatch(/all configured accounts failed/);

    const locksPath = path.join(home, ".web", "locks.json");
    const locks = JSON.parse(fs.readFileSync(locksPath, "utf8"));
    expect(Object.keys(locks).sort()).toEqual(["search:a", "search:b"]);
    expect(locks["search:a"].lockedUntil).toBeGreaterThan(Date.now());
    const firstUntil = locks["search:a"].lockedUntil as number;

    // Second run re-reads the persisted locks (both locked -> earliest-first
    // retry) and refreshes them after failing again.
    const second = await runWeb(["search", "q"], { HOME: home });
    expect(second.code).toBe(1);
    const locks2 = JSON.parse(fs.readFileSync(locksPath, "utf8"));
    expect(locks2["search:a"].lockedUntil).toBeGreaterThanOrEqual(firstUntil);
  });

  it("honors runtime.retry_rounds and lock_ttl_ms from config", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(
      ["config", "set", "search", "a", "--provider", "brave", "--base-url", "http://127.0.0.1:9"],
      { HOME: home },
    );
    const cfgPath = path.join(home, ".web", "config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    cfg.runtime.retry_rounds = 2;
    cfg.runtime.lock_ttl_ms = 60_000;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");

    const res = await runWeb(["search", "q"], { HOME: home });
    expect(res.code).toBe(1);
    const locks = JSON.parse(fs.readFileSync(path.join(home, ".web", "locks.json"), "utf8"));
    const ttl = locks["search:a"].lockedUntil - locks["search:a"].lockedAt;
    expect(ttl).toBe(60_000);
    // Two rounds over the single-account queue -> two attempts in the trail.
    const attemptCount = (res.stderr.match(/"id":\s*"a"/g) ?? []).length;
    expect(attemptCount).toBe(2);
  });
});
