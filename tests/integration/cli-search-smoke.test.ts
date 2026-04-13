import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runWeb } from "../helpers/run-web";

describe("cli search smoke (需 JINA_API_KEY)", () => {
  it.skipIf(!process.env.JINA_API_KEY?.trim())(
    "有密钥则 exit 0",
    () => {
    const webHome = fs.mkdtempSync(path.join(os.tmpdir(), "web-cli-test-"));
    fs.mkdirSync(webHome, { recursive: true });
    const toml = `
[search.account.jina-main]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = true

[fetch.account.http-main]
provider = "http"
enabled = true

[research.account.jina-main]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = true

[answer.account.ddg-main]
provider = "duckduckgo"
enabled = true
`;
    fs.writeFileSync(path.join(webHome, "config.toml"), toml.trimStart(), "utf8");
    fs.writeFileSync(path.join(webHome, ".env"), `JINA_API_KEY=${process.env.JINA_API_KEY}\n`, "utf8");
    const r = runWeb(["search", "jina ai", "--limit", "2"], {
      env: { ...process.env, WEB_HOME: webHome },
    });
    expect(r.status).toBe(0);
    expect((r.stdout + r.stderr).length).toBeGreaterThan(10);
    },
    60_000,
  );
});
