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

describe("CLI help + version", () => {
  it("root --help lists search/fetch/config/provider", async () => {
    const res = await runWeb(["--help"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("search");
    expect(res.stdout).toContain("fetch");
    expect(res.stdout).toContain("config");
    expect(res.stdout).toContain("provider");
    expect(res.stdout).not.toContain("research");
    expect(res.stdout).not.toContain("answer");
  });

  it("search --help documents flags", async () => {
    const res = await runWeb(["search", "--help"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/--provider/);
    expect(res.stdout).toMatch(/--freshness/);
  });

  it("--version prints the package version", async () => {
    const res = await runWeb(["--version"]);
    expect(res.code).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("CLI validation errors exit non-zero", () => {
  it("invalid --format is rejected", async () => {
    const res = await runWeb(["search", "x", "--format", "yaml"]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Invalid format/);
  });

  it("invalid --freshness is rejected before any network call", async () => {
    const home = freshHome();
    const res = await runWeb(["search", "x", "--freshness", "decade"], { HOME: home });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/freshness|Expected one of/);
  });

  it("invalid --limit is rejected", async () => {
    const home = freshHome();
    const res = await runWeb(["search", "x", "--limit", "0"], { HOME: home });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/limit|positive/);
  });

  it("invalid --wait-until is rejected", async () => {
    const home = freshHome();
    const res = await runWeb(["fetch", "https://example.com", "--wait-until", "forever"], { HOME: home });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/wait-until|Expected one of/);
  });

  it("config set with invalid group is rejected", async () => {
    const home = freshHome();
    const res = await runWeb(["config", "set", "bogus", "a", "--provider", "x"], { HOME: home });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Invalid group/);
  });
});
