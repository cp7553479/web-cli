/** Pick only keys present in allowlist (strict whitelist B). */
export function pickWhitelisted(
  vendorParams: Record<string, unknown> | undefined,
  allowlist: ReadonlySet<string>,
): Record<string, unknown> {
  if (!vendorParams) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vendorParams)) {
    if (allowlist.has(k)) out[k] = v;
  }
  return out;
}

/** Parse repeatable `--vendor key=value` into a record; invalid pairs skipped. */
export function parseVendorPairs(pairs: string[] | undefined): Record<string, unknown> {
  if (!pairs?.length) return {};
  const out: Record<string, unknown> = {};
  for (const p of pairs) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const key = p.slice(0, eq).trim();
    const raw = p.slice(eq + 1).trim();
    if (!key) continue;
    if (raw === "true") out[key] = true;
    else if (raw === "false") out[key] = false;
    else if (/^-?\d+$/.test(raw)) out[key] = Number(raw);
    else if (/^-?\d+\.\d+$/.test(raw)) out[key] = Number(raw);
    else out[key] = raw;
  }
  return out;
}
