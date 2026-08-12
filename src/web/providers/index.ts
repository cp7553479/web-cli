import type { PluginHost, ProviderBinding, ProviderFactory } from "../../core";
import { createBraveSearch } from "./brave";
import { createFirecrawlFetch, createFirecrawlSearch } from "./firecrawl";
import { createHtml2MarkdownFetch } from "./html2markdown";
import { createHttpFetch } from "./http";
import { createJinaFetch, createJinaSearch } from "./jina";
import { createPerplexitySearch } from "./perplexity";
import { createPlaywrightFetch } from "./playwright";
import { createTavilyFetch, createTavilySearch } from "./tavily";

export { PROVIDER_CATALOG, PROVIDER_MODELS, findCatalogEntry } from "./catalog";
export type { ProviderCatalogEntry } from "./catalog";

/**
 * Registers every built-in provider factory. Each factory declares which
 * capability segments it can build and dispatches `create(capability, binding)`
 * to the segment-specific constructor. External plugins register after this and
 * may override a same-named factory.
 */
export function registerBuiltinFactories(host: PluginHost): void {
  host.registerFactory("brave", factory(["search"], {
    search: createBraveSearch,
  }));

  host.registerFactory("tavily", factory(["search", "fetch"], {
    search: createTavilySearch,
    fetch: createTavilyFetch,
  }));

  host.registerFactory("jina", factory(["search", "fetch"], {
    search: createJinaSearch,
    fetch: createJinaFetch,
  }));

  host.registerFactory("firecrawl", factory(["search", "fetch"], {
    search: createFirecrawlSearch,
    fetch: createFirecrawlFetch,
  }));

  host.registerFactory("perplexity", factory(["search"], {
    search: createPerplexitySearch,
  }));

  host.registerFactory("http", factory(["fetch"], {
    fetch: createHttpFetch,
  }));

  host.registerFactory("html2markdown", factory(["fetch"], {
    fetch: createHtml2MarkdownFetch,
  }));

  host.registerFactory("playwright", factory(["fetch"], {
    fetch: createPlaywrightFetch,
  }));
}

type SegmentBuilder = (binding: ProviderBinding) => ReturnType<typeof createTavilySearch>;

function factory(
  capabilities: string[],
  builders: Record<string, SegmentBuilder>,
): ProviderFactory {
  return {
    capabilities,
    create(capability, binding) {
      const builder = builders[capability];
      if (!builder) {
        throw new Error(`Provider does not implement capability '${capability}'.`);
      }
      return builder(binding);
    },
  };
}
