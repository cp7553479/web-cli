import type { Command } from "commander";

import { AppError, errorMessage } from "../errors";

/**
 * Runs a configured commander `program` against `argv` with a uniform error
 * boundary: `AppError` (and ordinary Errors) print a concise message to stderr
 * and set `process.exitCode = 1`; commander's own usage/help errors keep their
 * behaviour. Stack traces are never shown in normal CLI output.
 *
 * `argv` defaults to `process.argv` (Node passes `["node", script, ...args]`).
 */
export async function runCliProgram(program: Command, argv: string[] = process.argv): Promise<void> {
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof AppError) {
      const lines = [error.message];
      if (error.details !== undefined) {
        lines.push(typeof error.details === "string" ? error.details : safeStringify(error.details));
      }
      process.stderr.write(`${lines.join("\n")}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`Error: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

/** Formats an error for display without secrets or stack traces. */
export function formatError(error: unknown): string {
  if (error instanceof AppError) {
    const lines = [error.message];
    if (error.details !== undefined) {
      lines.push(typeof error.details === "string" ? error.details : safeStringify(error.details));
    }
    return lines.join("\n");
  }
  return `Error: ${errorMessage(error)}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
