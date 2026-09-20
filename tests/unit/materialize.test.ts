import { describe, expect, it } from "vitest";

import { PluginHost, type ProviderFactory, type ProviderInstance } from "../../src/core";
import { materializeRegistries } from "../../src/web/config/materialize";
import type { WebConfig } from "../../src/web/config/types";

function fakeInstance(providerName: string, alias: string): ProviderInstance<unknown, unknown> {
  return { id: alias, providerName, account: { alias }, hooks: {} };
}

function hostWith(entries: Array<[string, string[]]>): PluginHost {
  const host = new PluginHost();
  for (const [name, capabilities] of entries) {
    const factory: ProviderFactory = { capabilities, create: () => fakeInstance(name, name) };
    host.registerFactory(name, factory);
  }
  return host;
}

describe("materializeRegistries provider toggle", () => {
  const baseConfig = {
    search: { account: { a: { provider: "tavily" }, b: { provider: "brave" } } },
    fetch: { account: {} },
  } as unknown as WebConfig;

  it("skips accounts whose provider is disabled via config.providers", () => {
    const config = {
      ...baseConfig,
      providers: { tavily: { enabled: false } },
    } as unknown as WebConfig;
    const { searchRegistry, skipped } = materializeRegistries(config, hostWith([["tavily", ["search"]], ["brave", ["search"]]]));
    expect(skipped).toEqual([
      { segment: "search", alias: "a", provider: "tavily", reason: "provider-disabled" },
    ]);
    expect(searchRegistry.list("search").map((i) => i.id)).toEqual(["brave"]);
  });

  it("keeps accounts when the provider is enabled or has no toggle", () => {
    const config = {
      ...baseConfig,
      providers: { tavily: { enabled: true } },
    } as unknown as WebConfig;
    const { skipped } = materializeRegistries(config, hostWith([["tavily", ["search"]], ["brave", ["search"]]]));
    expect(skipped).toEqual([]);
  });

  it("orders accounts by providers.primary then providers.list", () => {
    const config = {
      search: {
        providers: { primary: "brave", list: ["perplexity", "tavily"] },
        account: {
          t: { provider: "tavily" },
          b: { provider: "brave" },
          p: { provider: "perplexity" },
          j: { provider: "jina" },
        },
      },
      fetch: { account: {} },
    } as unknown as WebConfig;
    const { searchRegistry } = materializeRegistries(
      config,
      hostWith([["brave", ["search"]], ["tavily", ["search"]], ["perplexity", ["search"]], ["jina", ["search"]]]),
    );
    expect(searchRegistry.list("search").map((i) => i.providerName)).toEqual([
      "brave",
      "perplexity",
      "tavily",
      "jina",
    ]);
  });
});
