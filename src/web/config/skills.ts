import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { errorLog } from "../../core";

const SKILL_FILES = ["SKILL.md", "examples.md", "troubleshooting.md"] as const;

export interface SkillInstallResult {
  created: string[];
  skipped: string[];
}

/**
 * Locates the bundled skill templates (`init/skills/web-cli/`) by walking up
 * from this module — resolves both from `src/` (vitest) and from `dist/`
 * (installed package, where `init/` ships at the package root).
 */
function findTemplateDir(): string | undefined {
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(dir, "init", "skills", "web-cli");
    if (fs.existsSync(path.join(candidate, "SKILL.md"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Skill install targets: the managed `~/.web/skills`, the shared agent skills
 * dir `~/.agents/skills`, and — when a Hermes installation is detected — the
 * skills dir of EVERY profile under `~/.hermes/profiles/<profile>/skills`.
 */
export function getSkillInstallDirs(home: string = os.homedir()): string[] {
  const dirs = [
    path.join(home, ".web", "skills", "web-cli"),
    path.join(home, ".agents", "skills", "web-cli"),
  ];
  const profilesRoot = path.join(home, ".hermes", "profiles");
  if (fs.existsSync(profilesRoot)) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(profilesRoot, { withFileTypes: true });
    } catch (error) {
      errorLog("skills.hermes.readdir", error);
      return dirs;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(path.join(profilesRoot, entry.name, "skills", "web-cli"));
      }
    }
  }
  return dirs;
}

/**
 * Copies the bundled skill files into every install target. Existing files are
 * kept unless `force` is set, so auto-init never clobbers user edits.
 */
export function installSkills(force = false, home: string = os.homedir()): SkillInstallResult {
  const result: SkillInstallResult = { created: [], skipped: [] };
  const templateDir = findTemplateDir();
  if (!templateDir) {
    result.skipped.push("(bundled skill templates not found; skipping skill install)");
    return result;
  }
  for (const target of getSkillInstallDirs(home)) {
    for (const file of SKILL_FILES) {
      const dest = path.join(target, file);
      if (!force && fs.existsSync(dest)) {
        result.skipped.push(dest);
        continue;
      }
      fs.mkdirSync(target, { recursive: true });
      fs.copyFileSync(path.join(templateDir, file), dest);
      result.created.push(dest);
    }
  }
  return result;
}
