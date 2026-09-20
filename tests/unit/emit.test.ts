import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { emitResult } from "../../src/web/output/emit";
import type { GlobalFlags } from "../../src/web/cli/global-flags";

const tmpDirs: string[] = [];
const stdoutWrites: string[] = [];
let spy: ReturnType<typeof vi.spyOn> | undefined;

function flags(maxLength = 10): GlobalFlags {
  return { format: "markdown", maxLength, timeoutMs: 30_000 };
}

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "web-emit-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  spy?.mockRestore();
  spy = undefined;
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  stdoutWrites.length = 0;
});

function capture(): void {
  spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdoutWrites.push(String(chunk));
    return true;
  });
}

describe("emitResult", () => {
  it("prints output at or under the limit", () => {
    capture();
    emitResult("short output", flags(100), { globalRoot: tmpRoot() } as never);
    expect(stdoutWrites.join("")).toBe("short output\n");
  });

  it("spills oversized output to ~/.web/temp without a project .web", () => {
    capture();
    const globalRoot = tmpRoot();
    const cwd = tmpRoot();
    const output = "x".repeat(101);
    emitResult(output, flags(100), { globalRoot } as never, cwd);
    const file = path.join(globalRoot, "temp");
    const written = fs.readdirSync(file);
    expect(written).toHaveLength(1);
    expect(fs.readFileSync(path.join(file, written[0]!), "utf8")).toBe(output);
    expect(stdoutWrites.join("")).toMatch(/Saved to .*temp/);
  });

  it("prefers ./.web/temp when the project has a .web directory", () => {
    capture();
    const globalRoot = tmpRoot();
    const cwd = tmpRoot();
    fs.mkdirSync(path.join(cwd, ".web"));
    emitResult("y".repeat(101), flags(100), { globalRoot } as never, cwd);
    expect(fs.existsSync(path.join(cwd, ".web", "temp"))).toBe(true);
    expect(fs.existsSync(path.join(globalRoot, "temp"))).toBe(false);
  });
});
