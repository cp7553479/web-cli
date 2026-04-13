import fs from "node:fs";
import path from "node:path";

/** 可 `loadConfig` 通过校验：仅启用 fetch/http 与 answer/ddg，无需第三方密钥。 */
export function writeFetchHttpOnlyWebHome(rootDir: string): void {
  fs.mkdirSync(rootDir, { recursive: true });
  const toml = `
[search.account.placeholder]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = false

[fetch.account.http-main]
provider = "http"
enabled = true

[research.account.placeholder]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = false

[answer.account.ddg-main]
provider = "duckduckgo"
enabled = true
`;
  fs.writeFileSync(path.join(rootDir, "config.toml"), toml.trimStart(), "utf8");
  fs.writeFileSync(path.join(rootDir, ".env"), "# tests\n", "utf8");
}
