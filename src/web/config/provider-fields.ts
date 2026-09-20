import type { ProviderConfigField, ProviderConfigOption } from "../../core";

/**
 * Walks a provider's declared config fields into flat account values.
 * `SchemaIo` abstracts where answers come from: a readline-driven interactive
 * menu (TTY), or seeded answers (`--field`, scripts/tests).
 */
export interface SchemaIo {
  /** Free-text field: return "" to skip (the runtime default then applies). */
  ask(field: ProviderConfigField): Promise<string>;
  /** Option field: return the picked option, or undefined to skip the field. */
  choose(field: ProviderConfigField): Promise<ProviderConfigOption | undefined>;
}

/** Collects one flat value per answered field, recursing into nested levels. */
export async function collectFieldValues(
  fields: ProviderConfigField[],
  io: SchemaIo,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  await walkFields(fields, io, values);
  return values;
}

async function walkFields(
  fields: ProviderConfigField[],
  io: SchemaIo,
  values: Record<string, string>,
): Promise<void> {
  for (const field of fields) {
    if (field.options?.length) {
      const option = await io.choose(field);
      if (!option) continue;
      values[field.key] = option.value;
      if (option.fields?.length) await walkFields(option.fields, io, values);
    } else {
      const answer = await io.ask(field);
      if (answer) values[field.key] = answer;
    }
  }
}

/** Seeded IO for non-TTY runs: answers come from `--field key=value` only. */
export function seededIo(seed: Record<string, string>): SchemaIo {
  return {
    async ask(field) {
      return seed[field.key] ?? "";
    },
    async choose(field) {
      const seeded = seed[field.key];
      const match = field.options?.find((o) => o.value === seeded || o.label === seeded);
      return match;
    },
  };
}

/** Interactive IO: numbered menus on stdout, answers from readline (TTY). */
export function interactiveIo(): { io: SchemaIo; close(): void } {
  // Lazily required to keep the module loadable in non-interactive tooling.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const readline = require("node:readline") as typeof import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // If stdin hits EOF mid-question, settle pending prompts as "" so the
  // command degrades to "answers skipped" instead of hanging.
  let closed = false;
  let pending: ((answer: string) => void) | undefined;
  rl.on("close", () => {
    closed = true;
    pending?.("");
  });
  const ask = (question: string) =>
    new Promise<string>((resolve) => {
      if (closed) return resolve("");
      pending = resolve;
      rl.question(question, (answer) => {
        pending = undefined;
        resolve(answer);
      });
    });
  const io: SchemaIo = {
    async ask(field) {
      const suffix = field.default ? ` [${field.default}]` : "";
      return (await ask(`${field.label}${suffix}: `)).trim();
    },
    async choose(field) {
      const options = field.options ?? [];
      for (let i = 0; i < options.length; i++) {
        const o = options[i]!;
        const nested = o.fields?.length ? " +" : "";
        process.stdout.write(`  ${i + 1}) ${o.label}${nested}  (${o.value})\n`);
      }
      for (;;) {
        const defaultHint = field.default ? ` [${field.default}]` : "";
        const raw = (await ask(`${field.label} — select 1-${options.length}${defaultHint}: `)).trim();
        if (!raw && field.default) {
          const byDefault = options.find((o) => o.value === field.default);
          if (byDefault) return byDefault;
        }
        const index = Number(raw);
        if (Number.isInteger(index) && index >= 1 && index <= options.length) {
          return options[index - 1];
        }
        const byValue = options.find((o) => o.value === raw || o.label === raw);
        if (byValue) return byValue;
        process.stdout.write("Invalid selection; enter a number or a value.\n");
      }
    },
  };
  return { io, close: () => rl.close() };
}
