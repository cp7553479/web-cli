import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

const fetchHttpSmokeEnabled = () => process.env.WEB_RUN_FETCH_HTTP_SMOKE === "1";

describe("cli fetch smoke (http)", () => {
  it.skipIf(!fetchHttpSmokeEnabled())(
    "显式开启且 ./.web 已启用 http 账号时 exit 0（http:// 避免部分环境 TLS 链问题）",
    () => {
      const r = runWeb(["fetch", "http://example.com", "--provider", "http"]);
      expect(r.status).toBe(0);
      expect(r.stdout.toLowerCase()).toMatch(/example|doctype|html/i);
    },
  );
});
