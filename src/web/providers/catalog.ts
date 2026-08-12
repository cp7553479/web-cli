import type { SegmentName } from "../protocol/types";

export interface ProviderCatalogEntry {
  providerId: string;
  aliases: string[];
  defaultBaseUrl: string;
  description: string;
  capabilities: SegmentName[];
}

/**
 * Static metadata for built-in providers. Used by `web provider list` /
 * `web provider <id> models`. Provider identity (ids + aliases) lives here, in
 * the domain — core never holds a provider table.
 */
export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  { providerId: "brave", aliases: ["brave-search"], defaultBaseUrl: "https://api.search.brave.com", description: "Brave Search API", capabilities: ["search"] },
  { providerId: "tavily", aliases: [], defaultBaseUrl: "https://api.tavily.com", description: "Tavily search + extract", capabilities: ["search", "fetch"] },
  { providerId: "jina", aliases: ["jina-ai"], defaultBaseUrl: "https://r.jina.ai", description: "Jina search (s.jina.ai) + reader (r.jina.ai)", capabilities: ["search", "fetch"] },
  { providerId: "firecrawl", aliases: [], defaultBaseUrl: "https://api.firecrawl.dev", description: "Firecrawl v2 search + scrape", capabilities: ["search", "fetch"] },
  { providerId: "perplexity", aliases: ["sonar"], defaultBaseUrl: "https://api.perplexity.ai", description: "Perplexity Sonar (grounded answer + search results)", capabilities: ["search"] },
  { providerId: "http", aliases: [], defaultBaseUrl: "", description: "Raw HTTP GET (no key required)", capabilities: ["fetch"] },
  { providerId: "html2markdown", aliases: [], defaultBaseUrl: "", description: "Local HTML→Markdown via Readability + turndown", capabilities: ["fetch"] },
  { providerId: "playwright", aliases: [], defaultBaseUrl: "", description: "Browser fetch for JS-rendered pages (optional dep)", capabilities: ["fetch"] },
];

/** Built-in model lists for `web provider <id> models`. No live discovery in v1. */
export const PROVIDER_MODELS: Record<string, string[]> = {
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning-pro", "sonar-deep-research"],
};

export function findCatalogEntry(providerId: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find(
    (e) => e.providerId === providerId || e.aliases.includes(providerId),
  );
}
