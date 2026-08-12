import { describe, expect, it } from "vitest";

import {
  AppError,
  CurlTransport,
  ProviderError,
  ProviderPool,
  ProviderRegistry,
  type ProviderHooks,
  type ProviderInstance,
  type Transport,
  type TransportResult,
} from "../../src/core";

/**
 * A fake transport that returns scripted results (or throws scripted errors) in
 * sequence, letting us drive the pool through each FailureClass branch without
 * real HTTP. After the scripts run out, the last one repeats.
 */
function scriptedTransport(scripts: Array<TransportResult | Error>): Transport {
  let i = 0;
  return {
    async execute() {
      const next = scripts[i++] ?? scripts[scripts.length - 1];
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

function okResult(body: unknown): TransportResult {
  return { statusCode: 200, headers: {}, bodyText: JSON.stringify(body) };
}

function makeInstance<Req, Res>(
  id: string,
  providerName: string,
  hooks: ProviderHooks<Req, Res>,
): ProviderInstance<Req, Res> {
  return { id, providerName, account: { alias: id }, hooks };
}

describe("ProviderPool failover + classification", () => {
  it("returns the first successful instance", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: number[] }>();
    registry.register(
      "search",
      makeInstance("a", "stub", {
        buildRequest: () => ({ method: "GET", url: "u" }),
        parseResponse: () => ({ provider: "a", items: [1] }),
      }),
    );
    const pool = new ProviderPool(registry, scriptedTransport([okResult({})]));
    const out = await pool.run("req", { segment: "search" });
    expect(out).toEqual({ provider: "a", items: [1] });
  });

  it("advances the pointer on retryable-credential and tries the next account", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    registry.register(
      "search",
      makeInstance("bad", "stub", {
        buildRequest: () => ({ method: "GET", url: "u" }),
        parseResponse: () => {
          throw new ProviderError("retryable-credential", "401");
        },
      }),
    );
    registry.register(
      "search",
      makeInstance("good", "stub", {
        buildRequest: () => ({ method: "GET", url: "u" }),
        parseResponse: () => ({ provider: "good", items: ["ok"] }),
      }),
    );
    const pool = new ProviderPool(registry, scriptedTransport([okResult({}), okResult({})]));
    const out = await pool.run("req", { segment: "search" });
    expect(out.provider).toBe("good");
  });

  it("rotates past a non-retryable failure to the next account (always-rotate)", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    let goodCalled = false;
    registry.register(
      "search",
      makeInstance("bad", "stub", {
        buildRequest: () => ({ method: "GET", url: "u" }),
        parseResponse: () => {
          throw new ProviderError("non-retryable-request", "400 bad request");
        },
      }),
    );
    registry.register(
      "search",
      makeInstance("good", "stub", {
        buildRequest: () => {
          goodCalled = true;
          return { method: "GET", url: "u" };
        },
        parseResponse: () => ({ provider: "good", items: ["ok"] }),
      }),
    );
    const pool = new ProviderPool(registry, scriptedTransport([okResult({}), okResult({})]));
    // Always-rotate: even a "non-retryable-request" advances to the next account
    // (HTTP status is an unreliable signal — see pool.ts comment).
    const out = await pool.run("req", { segment: "search" });
    expect(out.provider).toBe("good");
    expect(goodCalled).toBe(true);
  });

  it("throws *_ALL_FAILED when every candidate fails with retryable classes", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    for (const id of ["a", "b"]) {
      registry.register(
        "search",
        makeInstance(id, "stub", {
          buildRequest: () => ({ method: "GET", url: "u" }),
          parseResponse: () => {
            throw new ProviderError("retryable-transport", "503");
          },
        }),
      );
    }
    const pool = new ProviderPool(registry, scriptedTransport([okResult({}), okResult({})]));
    await expect(pool.run("req", { segment: "search" })).rejects.toMatchObject({
      code: "SEARCH_ALL_FAILED",
    });
  });

  it("throws *_NO_ACCOUNTS when the segment is empty", async () => {
    const registry = new ProviderRegistry<string, unknown>();
    const pool = new ProviderPool(registry, scriptedTransport([]));
    await expect(pool.run("req", { segment: "search" })).rejects.toMatchObject({
      code: "SEARCH_NO_ACCOUNTS",
    });
  });

  it("uses classifyFailure hook for non-ProviderError errors", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    registry.register(
      "search",
      makeInstance("bad", "stub", {
        buildRequest: () => {
          throw new Error("boom");
        },
        parseResponse: () => ({ provider: "bad", items: [] }),
        classifyFailure: () => "unsupported",
      }),
    );
    registry.register(
      "search",
      makeInstance("good", "stub", {
        buildRequest: () => ({ method: "GET", url: "u" }),
        parseResponse: () => ({ provider: "good", items: ["ok"] }),
      }),
    );
    const pool = new ProviderPool(registry, scriptedTransport([okResult({})]));
    const out = await pool.run("req", { segment: "search" });
    expect(out.provider).toBe("good");
  });

  it("preferred() puts the configured default account first", async () => {
    const order: string[] = [];
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    for (const id of ["a", "b", "c"]) {
      registry.register(
        "search",
        makeInstance(id, "stub", {
          buildRequest: () => ({ method: "GET", url: "u" }),
          parseResponse: () => {
            order.push(id);
            return { provider: id, items: [] };
          },
        }),
      );
    }
    const pool = new ProviderPool(registry, scriptedTransport([okResult({})]), {
      preferred: () => "c",
    });
    await pool.run("req", { segment: "search" });
    expect(order[0]).toBe("c");
  });

  it("forcedAccount pins one instance and validates provider match", async () => {
    const registry = new ProviderRegistry<string, { provider: string; items: string[] }>();
    registry.register("search", makeInstance("a", "tavily", {
      buildRequest: () => ({ method: "GET", url: "u" }),
      parseResponse: () => ({ provider: "a", items: [] }),
    }));
    const pool = new ProviderPool(registry, scriptedTransport([okResult({})]));
    await expect(
      pool.run("req", { segment: "search", forcedAccount: "a", forcedProvider: "brave" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_PROVIDER_MISMATCH" });
  });

  it("CurlTransport is the default transport implementation (exported)", () => {
    expect(typeof CurlTransport).toBe("function");
    expect(new CurlTransport()).toBeInstanceOf(CurlTransport);
  });

  it("AppError carries code + details", () => {
    const e = new AppError("msg", "CODE", { x: 1 });
    expect(e.code).toBe("CODE");
    expect(e.details).toEqual({ x: 1 });
  });
});
