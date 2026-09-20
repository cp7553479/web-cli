import fs from "node:fs";
import path from "node:path";

/** Default cooldown for a failed account: 15 minutes. */
export const DEFAULT_LOCK_TTL_MS = 15 * 60 * 1000;

/** One failed account's cooldown state. Epoch values are ms. */
export interface LockEntry {
  lockedAt: number;
  lockedUntil: number;
  reason?: string;
}

/** Lock state keyed by `<segment>:<alias>`. Persisted as JSON to disk. */
export type LockFileData = Record<string, LockEntry>;

/** Reads the lock file; missing or corrupt file yields `{}` (tolerant). */
export function readLocks(file: string | undefined): LockFileData {
  if (!file || !fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as LockFileData;
    }
  } catch {
    // fall through
  }
  return {};
}

/** Returns the lock entry for `key` when it is still active at `now`. */
export function activeLock(data: LockFileData, key: string, now: number): LockEntry | undefined {
  const entry = data[key];
  return entry && entry.lockedUntil > now ? entry : undefined;
}

/** Persists a cooldown for `key` (atomic tmp+rename write). */
export function lockAccount(
  file: string | undefined,
  key: string,
  ttlMs: number,
  reason?: string,
): void {
  if (!file) return;
  const data = readLocks(file);
  const now = Date.now();
  data[key] = { lockedAt: now, lockedUntil: now + ttlMs, reason };
  writeLocks(file, data);
}

/** Removes the cooldown for `key` (e.g. the account just succeeded). */
export function clearLock(file: string | undefined, key: string): void {
  if (!file) return;
  const data = readLocks(file);
  if (!(key in data)) return;
  delete data[key];
  writeLocks(file, data);
}

function writeLocks(file: string, data: LockFileData): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}
