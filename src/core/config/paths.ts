import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AppPaths {
  /** Global config root, e.g. `~/.web`. */
  globalRoot: string;
  globalConfig: string;
  globalCurrent: string;
  globalEnv: string;
  globalPlugins: string;
  /** Project config root, e.g. `./.web`, when it exists (else undefined). */
  projectRoot?: string;
  projectConfig?: string;
  projectCurrent?: string;
  projectEnv?: string;
  projectPlugins?: string;
  /**
   * Effective logs directory: project `.web/logs` when a project root exists,
   * otherwise the global `.web/logs`.
   */
  logsDir: string;
}

/**
 * Resolves all filesystem paths for an app named `appName` (e.g. `".web"`).
 * Pure path computation plus a single existence check for the project root.
 * Core never reads/writes config here — that is the loader's job.
 */
export function getAppPaths(appName: string, cwd: string = process.cwd()): AppPaths {
  const globalRoot = path.join(os.homedir(), `${appName}`);
  const projectRoot = path.join(cwd, `${appName}`);
  const hasProject = fs.existsSync(path.join(projectRoot, "config.json"));

  const projectRootResolved = hasProject ? projectRoot : undefined;

  const logsDir = projectRootResolved
    ? path.join(projectRootResolved, "logs")
    : path.join(globalRoot, "logs");

  return {
    globalRoot,
    globalConfig: path.join(globalRoot, "config.json"),
    globalCurrent: path.join(globalRoot, "current.json"),
    globalEnv: path.join(globalRoot, ".env"),
    globalPlugins: path.join(globalRoot, "plugins"),
    projectRoot: projectRootResolved,
    projectConfig: projectRootResolved ? path.join(projectRootResolved, "config.json") : undefined,
    projectCurrent: projectRootResolved ? path.join(projectRootResolved, "current.json") : undefined,
    projectEnv: projectRootResolved ? path.join(projectRootResolved, ".env") : undefined,
    projectPlugins: projectRootResolved ? path.join(projectRootResolved, "plugins") : undefined,
    logsDir,
  };
}

/**
 * Reads `current.json` (the active-account pointer) from the project path when
 * present, otherwise the global path. Returns `{}` when absent or unparseable.
 */
export function readCurrentPointer(paths: AppPaths): Record<string, string> {
  const file = paths.projectCurrent ?? paths.globalCurrent;
  return readJsonRecord(file);
}

/** Small helper: parse a JSON file into a string-keyed record, tolerantly. */
export function readJsonRecord(file: string | undefined): Record<string, string> {
  if (!file || !fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // fall through
  }
  return {};
}
