import { describe, expect, it } from "vitest";

import { PluginHost, ProviderError, type HookCtx, type TransportResult } from "../../src/core";
import { activate as exaActivate } from "../../src/web/plugins/builtin/exa";
import { activate as searxngActivate } from "../../src/web/plugins/builtin/searxng";
import { activate as serperActivate } from "../../src/web/plugins/builtin/serper";
import type { ProviderResponse } from "../../src/web/protocol/types";

type AnyInstance = ReturnType<NonNullable<ReturnType<PluginHost["getFactory"]>>["create"]>;

function instanceFor(activate: (host: PluginHost) => void, providerName: string, baseUrl?: string): AnyInstance {
  const host = new PluginHost();
  activate(host);
  const factory = host.getFactory(providerName);
  if (!factory) throw new Error(`factory ${providerName} not registered`);
  return factory.create("search", { alias: "acc", providerName, apiToken: "test-key", baseUrl });
}

function ctxOf(instance: AnyInstance): HookCtx {
  return { account: instance.account, timeoutMs: 1000 };
}

function ok(body: unknown): TransportResult {
  return { statusCode: 200, headers: {}, bodyText: JSON.stringify(body) };
}

const SEARCH_REQ = { query: "hello world", limit: 5 } as never;

describe("exa plugin", () => {
  it("builds POST {base}/search with x-api-key and parses results", async () => {
    const inst = instanceFor(exaActivate, "exa");
    const req = await inst.hooks.buildRequest!(SEARCH_REQ, ctxOf(inst));
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.exa.ai/search");
    expect((req.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    expect(req.json).toEqual({ query: "hello world", numResults: 5 });

    const res = (await inst.hooks.parseResponse!(
      ok({ results: [{ title: "T", url: "https://u", publishedDate: "2026-01-01" }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "T", url: "https://u", source: "exa" });
  });

  it("maps site filters and freshness to startPublishedDate", async () => {
    const inst = instanceFor(exaActivate, "exa");
    const req = await inst.hooks.buildRequest!(
      { query: "q", limit: 3, site: ["a.com"], freshness: "week" } as never,
      ctxOf(inst),
    );
    const body = req.json as { includeDomains: string[]; startPublishedDate: string };
    expect(body.includeDomains).toEqual(["a.com"]);
    expect(body.startPublishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("serper plugin", () => {
  it("builds POST {base}/search with X-API-KEY and maps organic results", async () => {
    const inst = instanceFor(serperActivate, "serper");
    const req = await inst.hooks.buildRequest!(SEARCH_REQ, ctxOf(inst));
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://google.serper.dev/search");
    expect((req.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    expect(req.json).toEqual({ q: "hello world", num: 5 });

    const res = (await inst.hooks.parseResponse!(
      ok({ organic: [{ title: "T", link: "https://u", snippet: "s", position: 1 }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "T", url: "https://u", snippet: "s", source: "serper" });
  });

  it("appends site: operators to the query", async () => {
    const inst = instanceFor(serperActivate, "serper");
    const req = await inst.hooks.buildRequest!(
      { query: "q", limit: 3, site: ["a.com", "b.com"] } as never,
      ctxOf(inst),
    );
    expect((req.json as { q: string }).q).toBe("q site:a.com site:b.com");
  });
});

describe("searxng plugin", () => {
  it("builds GET {base}/search?format=json and parses results", async () => {
    const inst = instanceFor(searxngActivate, "searxng", "https://searx.example.com");
    const req = await inst.hooks.buildRequest!(SEARCH_REQ, ctxOf(inst));
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://searx.example.com/search?q=hello%20world&format=json");
    expect(req.headers).toEqual({ Accept: "application/json" });

    const res = (await inst.hooks.parseResponse!(
      ok({ results: [{ title: "T", url: "https://u", content: "c" }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "T", url: "https://u", content: "c", source: "searxng" });
  });

  it("fails fast without a base_url (self-hosted)", async () => {
    const inst = instanceFor(searxngActivate, "searxng");
    expect(() => inst.hooks.buildRequest!(SEARCH_REQ, ctxOf(inst))).toThrow(ProviderError);
  });

  it("declares a base_url config schema field", () => {
    const host = new PluginHost();
    searxngActivate(host);
    const factory = host.getFactory("searxng")!;
    expect(factory.config?.map((f) => f.key)).toEqual(["base_url"]);
  });
});
