import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { deepMerge, resolveEnvTokens } from "../../src/core/config/config";
import { getAppPaths } from "../../src/core/config/paths";
import { webConfigValidator } from "../../src/web/config/schema";
import { loadWebConfig } from "../../src/web/config";

describe("deepMerge", () => {
  it("unions nested account maps with overlay winning on alias collision", () => {
    const base = {
      search: { account: { a: { provider: "brave" }, b: { provider: "tavily" } } },
    };
    const overlay = {
      search: { account: { b: { provider: "jina" }, c: { provider: "http" } } },
    };
    const out = deepMerge(base, overlay) as {
      search: { account: Record<string, { provider: string }> };
    };
    expect(Object.keys(out.search.account).sort()).toEqual(["a", "b", "c"]);
    expect(out.search.account.b.provider).toBe("jina");
  });

  it("overlay scalars win; arrays replace", () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: 9 })).toEqual({ a: 9, b: 2 });
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

describe("resolveEnvTokens", () => {
  it("substitutes whole-field {$VAR} tokens", () => {
    expect(resolveEnvTokens({ token: "{$KEY}", url: "https://x" }, { KEY: "secret" })).toEqual({
      token: "secret",
      url: "https://x",
    });
  });

  it("throws on missing env (whole-field only)", () => {
    expect(() => resolveEnvTokens("{$MISSING}", {})).toThrow(/Environment variable 'MISSING' is not set/);
  });

  it("leaves partial tokens (not whole-field) untouched", () => {
    expect(resolveEnvTokens("https://{$HOST}/p", { HOST: "x" })).toBe("https://{$HOST}/p");
  });
});

describe("getAppPaths", () => {
  it("uses project logs dir when a project config.json exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "web-paths-"));
    const projectRoot = path.join(tmp, ".web");
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "config.json"), "{}");
    const paths = getAppPaths(".web", tmp);
    expect(paths.projectRoot).toBe(projectRoot);
    expect(paths.logsDir).toBe(path.join(projectRoot, "logs"));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("falls back to global logs dir without a project", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "web-paths-"));
    const paths = getAppPaths(".web", tmp);
    expect(paths.projectRoot).toBeUndefined();
    expect(paths.logsDir).toBe(path.join(paths.globalRoot, "logs"));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("webConfigValidator", () => {
  it("accepts a minimal config and defaults empty segments", () => {
    const out = webConfigValidator.validate({});
    expect(out.search.account).toEqual({});
    expect(out.fetch.account).toEqual({});
  });

  it("rejects an account missing provider", () => {
    expect(() => webConfigValidator.validate({ search: { account: { a: {} } } })).toThrow(/provider is required/);
  });

  it("rejects a non-boolean enabled", () => {
    expect(() =>
      webConfigValidator.validate({ search: { account: { a: { provider: "x", enabled: "yes" } } } }),
    ).toThrow(/enabled must be a boolean/);
  });
});

describe("loadWebConfig end-to-end", () => {
  const tmpDirs: string[] = [];
  const realHome = process.env.HOME;

  afterEach(() => {
    process.env.HOME = realHome;
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function withTmpHome(): { home: string; cwd: string } {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-home-"));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "web-cwd-"));
    tmpDirs.push(home, cwd);
    process.env.HOME = home; // os.homedir() reads HOME at call time on POSIX
    return { home, cwd };
  }

  it("bootstraps a default config on first run and loads empty accounts", () => {
    const { cwd } = withTmpHome();
    const { config, paths } = loadWebConfig(cwd);
    expect(fs.existsSync(paths.globalConfig)).toBe(true);
    expect(config.search.account).toEqual({});
    expect(config.fetch.account).toEqual({});
  });

  it("merges project overlay onto global and resolves {$ENV} tokens", () => {
    const { home, cwd } = withTmpHome();
    const globalRoot = path.join(home, ".web");
    fs.mkdirSync(globalRoot, { recursive: true });
    fs.writeFileSync(
      path.join(globalRoot, "config.json"),
      JSON.stringify({ search: { account: { a: { provider: "brave" } } } }),
    );
    const projectRoot = path.join(cwd, ".web");
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, "config.json"),
      JSON.stringify({ search: { account: { b: { provider: "tavily", api_token: "{$TKEY}" } } } }),
    );
    fs.writeFileSync(path.join(projectRoot, ".env"), "TKEY=secret123\n");

    const { config } = loadWebConfig(cwd);
    expect(Object.keys(config.search.account).sort()).toEqual(["a", "b"]);
    expect(config.search.account.b.api_token).toBe("secret123");
  });
});
