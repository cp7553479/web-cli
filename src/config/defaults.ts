import type { WebConfig } from "./types";

export function defaultConfig(): WebConfig {
  return {
    search: {
      account: {
        "jina-main": { provider: "jina", api_token: "{$JINA_API_KEY}", enabled: true },
      },
    },
    fetch: {
      account: {
        "jina-reader": { provider: "jina", api_token: "{$JINA_API_KEY}", enabled: true },
        "playwright-main": { provider: "playwright", enabled: true },
        "html2markdown-main": { provider: "html2markdown", enabled: true },
        "http-main": { provider: "http", enabled: false },
      },
    },
    research: {
      account: {},
    },
    answer: {
      account: {
        "ddg-main": { provider: "duckduckgo", enabled: true },
      },
    },
    runtime: {
      logging: true,
    },
  };
}
