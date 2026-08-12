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

const SMOKE = process.env.WEB_RUN_FETCH_HTTP_SMOKE === "1";

describe("http provider fetch (live)", { skip: !SMOKE }, () => {
  it("fetches example.com via curl http provider", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "set", "fetch", "h", "--provider", "http"], { HOME: home });
    const res = await runWeb(["fetch", "https://example.com", "--provider", "h", "--max-length", "300"], { HOME: home });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Example Domain");
  });
});

// Always-on assertion: without the smoke flag, this test just confirms the
// command wires up (config + account) without making a network call.
describe("http provider wiring (offline)", () => {
  it("configures an http account and lists it", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    const set = await runWeb(["config", "set", "fetch", "raw", "--provider", "http"], { HOME: home });
    expect(set.code).toBe(0);
    const list = await runWeb(["config", "list"], { HOME: home });
    expect(list.stdout).toContain("provider=http");
  });
});
