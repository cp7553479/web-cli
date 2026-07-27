import { describe, expect, it, vi } from "vitest";

import { httpJson } from "../../src/core/http";
import { FirecrawlSearchProvider } from "../../src/providers/official";

vi.mock("../../src/core/http", () => ({
  httpJson: vi.fn(),
}));

describe("FirecrawlSearchProvider", () => {
  it("maps the official v2 data.web response", async () => {
    vi.mocked(httpJson).mockResolvedValue({
      success: true,
      data: {
        web: [
          {
            title: "OpenAI",
            description: "OpenAI homepage",
            url: "https://openai.com/",
          },
        ],
      },
    });

    const provider = new FirecrawlSearchProvider({
      alias: "firecrawl-main",
      provider: "firecrawl",
      apiToken: "fc-test",
    });
    const result = await provider.search(
      { query: "OpenAI", limit: 1 },
      { timeoutMs: 10_000 },
    );

    expect(result.items).toEqual([
      {
        title: "OpenAI",
        url: "https://openai.com/",
        snippet: "OpenAI homepage",
        source: "firecrawl_search",
      },
    ]);
  });
});
