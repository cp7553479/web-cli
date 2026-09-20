import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const tmpPaths: string[] = [];

function freshHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-init-"));
  tmpPaths.push(home);
  return home;
}

function freshCwd(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "web-proj-"));
  tmpPaths.push(cwd);
  return cwd;
}

afterEach(() => {
  while (tmpPaths.length) fs.rmSync(tmpPaths.pop()!, { recursive: true, force: true });
});

describe("first-run auto-init", () => {
  it("auto-creates config + .env and installs skills to ~/.web, ~/.agents, and every hermes profile", async () => {
    const home = freshHome();
    for (const profile of ["alpha", "beta"]) {
      fs.mkdirSync(path.join(home, ".hermes", "profiles", profile), { recursive: true });
    }

    const res = await runWeb(["config", "list"], { HOME: home });
    expect(res.code).toBe(0);
    expect(fs.existsSync(path.join(home, ".web", "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(home, ".web", ".env"))).toBe(true);
    expect(res.stderr).toMatch(/web: initialized/);
    expect(fs.existsSync(path.join(home, ".web", "skills", "web-cli", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(home, ".agents", "skills", "web-cli", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(home, ".hermes", "profiles", "alpha", "skills", "web-cli", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(home, ".hermes", "profiles", "beta", "skills", "web-cli", "SKILL.md"))).toBe(true);
  });

  it("keeps existing skill files on later runs", async () => {
    const home = freshHome();
    await runWeb(["config", "list"], { HOME: home });
    const skill = path.join(home, ".agents", "skills", "web-cli", "SKILL.md");
    fs.writeFileSync(skill, "custom", "utf8");
    await runWeb(["config", "list"], { HOME: home });
    expect(fs.readFileSync(skill, "utf8")).toBe("custom");
  });

  it("config init --force refreshes installed skill files", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    const skill = path.join(home, ".agents", "skills", "web-cli", "SKILL.md");
    fs.writeFileSync(skill, "custom", "utf8");
    const res = await runWeb(["config", "init", "--force"], { HOME: home });
    expect(res.code).toBe(0);
    expect(fs.readFileSync(skill, "utf8")).not.toBe("custom");
    expect(res.stdout).toMatch(/Created:/);
  });
});

describe("project scope (cwd .web wins)", () => {
  it("config list reads the project config inside a project dir, global elsewhere", async () => {
    const home = freshHome();
    await runWeb(["config", "init"], { HOME: home });
    await runWeb(["config", "set", "search", "global-acc", "--provider", "brave"], { HOME: home });

    const cwd = freshCwd();
    fs.mkdirSync(path.join(cwd, ".web"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, ".web", "config.json"),
      JSON.stringify({ search: { account: { "project-acc": { provider: "tavily" } } }, fetch: { account: {} } }),
    );

    const inProject = await runWeb(["config", "list"], { HOME: home }, cwd);
    expect(inProject.code).toBe(0);
    expect(inProject.stdout).toContain("project-acc");
    expect(inProject.stdout).not.toContain("global-acc");

    const outside = await runWeb(["config", "list"], { HOME: home });
    expect(outside.stdout).toContain("global-acc");
    expect(outside.stdout).not.toContain("project-acc");
  });

  it("config use inside a project writes the project current.json", async () => {
    const home = freshHome();
    const cwd = freshCwd();
    fs.mkdirSync(path.join(cwd, ".web"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, ".web", "config.json"),
      JSON.stringify({ search: { account: { "project-acc": { provider: "tavily" } } }, fetch: { account: {} } }),
    );

    const use = await runWeb(["config", "use", "search", "project-acc"], { HOME: home }, cwd);
    expect(use.code).toBe(0);
    expect(fs.existsSync(path.join(cwd, ".web", "current.json"))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(cwd, ".web", "current.json"), "utf8"))).toEqual({
      search: "project-acc",
    });
  });
});
