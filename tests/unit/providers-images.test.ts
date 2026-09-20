import { describe, expect, it } from "vitest";

import { PluginHost, type HookCtx, type TransportResult } from "../../src/core";
import { activate as pexelsActivate } from "../../src/web/plugins/builtin/pexels";
import { activate as pixabayActivate } from "../../src/web/plugins/builtin/pixabay";
import { activate as serperActivate } from "../../src/web/plugins/builtin/serper";
import type { ProviderResponse } from "../../src/web/protocol/types";
import { buildImageSearchRequest } from "../../src/web/protocol/requests";

type AnyInstance = ReturnType<NonNullable<ReturnType<PluginHost["getFactory"]>>["create"]>;

function instanceFor(activate: (host: PluginHost) => void, providerName: string): AnyInstance {
  const host = new PluginHost();
  activate(host);
  const factory = host.getFactory(providerName)!;
  return factory.create("images", { alias: "acc", providerName, apiToken: "test-key" });
}

function ctxOf(instance: AnyInstance): HookCtx {
  return { account: instance.account, timeoutMs: 1000 };
}

function ok(body: unknown): TransportResult {
  return { statusCode: 200, headers: {}, bodyText: JSON.stringify(body) };
}

const IMG_REQ = buildImageSearchRequest({ query: "sunset", limit: 8 });

describe("buildImageSearchRequest", () => {
  it("validates query and limit", () => {
    expect(() => buildImageSearchRequest({ query: "  ", limit: 8 })).toThrow(/Query is required/);
    expect(buildImageSearchRequest({ query: "q", limit: 3 }).limit).toBe(3);
  });
});

describe("serper images capability", () => {
  it("declares images capability and builds POST {base}/images", async () => {
    const host = new PluginHost();
    serperActivate(host);
    expect(host.getFactory("serper")!.capabilities).toEqual(["search", "images"]);

    const inst = instanceFor(serperActivate, "serper");
    const req = await inst.hooks.buildRequest!(IMG_REQ, ctxOf(inst));
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://google.serper.dev/images");
    expect((req.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    expect(req.json).toEqual({ q: "sunset", num: 8 });

    const res = (await inst.hooks.parseResponse!(
      ok({ images: [{ title: "Sunset", imageUrl: "https://img/1", link: "https://page", source: "example.com" }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "Sunset", url: "https://img/1", source: "serper" });
  });
});

describe("pixabay plugin", () => {
  it("builds GET with key param and parses hits", async () => {
    const inst = instanceFor(pixabayActivate, "pixabay");
    const req = await inst.hooks.buildRequest!(IMG_REQ, ctxOf(inst));
    expect(req.method).toBe("GET");
    expect(req.url).toContain("https://pixabay.com/api/?");
    expect(req.url).toContain("key=test-key");
    expect(req.url).toContain("q=sunset");
    expect(req.url).toContain("per_page=8");

    const res = (await inst.hooks.parseResponse!(
      ok({ hits: [{ tags: "sunset, sea", largeImageURL: "https://img/l", pageURL: "https://pixabay.com/p/1" }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "sunset, sea", url: "https://img/l", source: "pixabay" });
  });
});

describe("pexels plugin", () => {
  it("builds GET {base}/search with Authorization and parses photos", async () => {
    const inst = instanceFor(pexelsActivate, "pexels");
    const req = await inst.hooks.buildRequest!(IMG_REQ, ctxOf(inst));
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://api.pexels.com/v1/search?query=sunset&per_page=8");
    expect((req.headers as Record<string, string>).Authorization).toBe("test-key");

    const res = (await inst.hooks.parseResponse!(
      ok({ photos: [{ alt: "mountain sunset", photographer: "Jane", src: { large: "https://img/p" } }] }),
      {} as never,
      ctxOf(inst),
    )) as ProviderResponse;
    expect(res.items[0]).toMatchObject({ title: "mountain sunset", url: "https://img/p", snippet: "Jane", source: "pexels" });
  });
});
