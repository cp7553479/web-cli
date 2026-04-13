import { loadConfig } from "../config";
import type { WebConfig } from "../config/types";
import { FileLogger } from "../core/logger";
import { Orchestrator } from "../core/orchestrator";
import type { GlobalFlags } from "../core/types";
import { createRegistry } from "../providers";

export interface AppContext {
  app: Orchestrator;
  config: WebConfig;
  fileLogger?: FileLogger;
}

export function createAppContext(flags: GlobalFlags): AppContext {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const registry = createRegistry(config, { cwd });

  const loggingEnabled = config.runtime?.logging !== false;
  const fileLogger = loggingEnabled ? new FileLogger(cwd) : undefined;

  const app = new Orchestrator(config, registry, {
    timeoutMs: flags.timeoutMs,
    fileLogger,
  });
  return { app, config, fileLogger };
}

