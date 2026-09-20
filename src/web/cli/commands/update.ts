import { execFile, spawn } from "node:child_process";

import { Command } from "commander";

import { AppError } from "../../../core";
import { version } from "../../../../package.json";

const PACKAGE = "@cp7553479/web-cli";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description(`Update the CLI to the latest published version of ${PACKAGE}`)
    .option("--check", "only report whether a newer version exists")
    .action(async (opts: { check?: boolean }) => {
      const latest = await fetchLatestVersion();
      if (compareVersions(latest, version) <= 0) {
        process.stdout.write(`web ${version} is up to date (latest: ${latest})\n`);
        return;
      }
      if (opts.check) {
        process.stdout.write(`update available: ${version} -> ${latest} (run 'web update')\n`);
        return;
      }
      await npmInstallLatest();
      process.stdout.write(`updated: ${version} -> ${latest}\n`);
    });
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("npm", ["view", PACKAGE, "version"], { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new AppError(
            `Cannot resolve the latest version of ${PACKAGE} via npm: ${(stderr || error.message).trim()}`,
            "UPDATE_NPM_FAILED",
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function npmInstallLatest(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", `${PACKAGE}@latest`], { stdio: "inherit" });
    child.on("error", (error) => reject(new AppError(`npm not found: ${error.message}`, "UPDATE_NPM_FAILED")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new AppError(`npm install -g ${PACKAGE}@latest exited with code ${code}`, "UPDATE_NPM_FAILED"));
        return;
      }
      resolve();
    });
  });
}
