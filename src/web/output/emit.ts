import fs from "node:fs";
import path from "node:path";

import type { AppPaths } from "../../core";
import type { GlobalFlags } from "../cli/global-flags";

const EXTENSIONS: Record<GlobalFlags["format"], string> = { json: "json", markdown: "md", text: "txt" };

/**
 * Emits rendered output. Content at or under `--max-length` goes to stdout;
 * anything larger spills the COMPLETE record to a file — `./.web/temp/` when
 * the project has a `.web` directory, else `~/.web/temp/` — and stdout prints
 * the file path.
 */
export function emitResult(
  output: string,
  flags: GlobalFlags,
  paths: AppPaths,
  cwd: string = process.cwd(),
): void {
  if (output.length <= flags.maxLength) {
    process.stdout.write(`${output}\n`);
    return;
  }
  const hasProjectWeb = fs.existsSync(path.join(cwd, ".web"));
  const tempDir = hasProjectWeb ? path.join(cwd, ".web", "temp") : path.join(paths.globalRoot, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const file = path.join(tempDir, `${Date.now()}.${EXTENSIONS[flags.format]}`);
  fs.writeFileSync(file, output, "utf8");
  process.stdout.write(
    `Output too large (${output.length} chars, limit ${flags.maxLength}). Saved to ${file} — read that file for the full content.\n`,
  );
}
