import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const jinaLiveSmokeEnabled = () => process.env.WEB_RUN_JINA_SMOKE === "1";

describe("cli search smoke（显式 WEB_RUN_JINA_SMOKE=1）", () => {
  it.skipIf(!jinaLiveSmokeEnabled())(
    "密钥由 ~/.web/.env 与 ./.web/.env 合并提供时 exit 0",
    () => {
      const r = runWeb(["search", "jina ai", "--limit", "2"]);
      expect(r.status).toBe(0);
      expect((r.stdout + r.stderr).length).toBeGreaterThan(10);
    },
    60_000,
  );
});
