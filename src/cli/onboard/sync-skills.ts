import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolvePackageInitDir } from "./init-paths";

const OPTIONAL_AGENT_SKILL_PARENTS = [
  ".agent/skills",
  ".claude/skills",
  ".openclaw/skills",
  ".codex/skills",
  ".gemini/skills",
] as const;

function copyWebCliInto(parentDir: string): void {
  const src = path.join(resolvePackageInitDir(), "skills", "web-cli");
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(parentDir, { recursive: true });
  const dest = path.join(parentDir, "web-cli");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

/** 将 `init/skills/web-cli` 同步到 ~/.web/skills；若各 Agent 的 `~/.* /skills` 已存在则覆盖其下 `web-cli`。 */
export function syncAgentSkillsFromPackage(): void {
  const home = os.homedir();
  copyWebCliInto(path.join(home, ".web", "skills"));

  for (const rel of OPTIONAL_AGENT_SKILL_PARENTS) {
    const parent = path.join(home, rel);
    if (fs.existsSync(parent)) {
      copyWebCliInto(parent);
    }
  }
}
