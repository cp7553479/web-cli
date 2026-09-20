import type { SegmentName } from "../../protocol/types";

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
  { providerId: "exa", aliases: ["exa-ai"], defaultBaseUrl: "https://api.exa.ai", description: "Exa neural/web search API", capabilities: ["search"] },
  { providerId: "serper", aliases: [], defaultBaseUrl: "https://google.serper.dev", description: "Serper Google search API (web + images)", capabilities: ["search", "images"] },
  { providerId: "searxng", aliases: ["searx"], defaultBaseUrl: "", description: "SearXNG self-hosted metasearch (JSON API; set base_url to your instance)", capabilities: ["search"] },
  { providerId: "pixabay", aliases: [], defaultBaseUrl: "https://pixabay.com/api", description: "Pixabay royalty-free image search (free API key)", capabilities: ["images"] },
  { providerId: "pexels", aliases: [], defaultBaseUrl: "https://api.pexels.com/v1", description: "Pexels free stock photo search (free API key)", capabilities: ["images"] },
  { providerId: "http", aliases: [], defaultBaseUrl: "", description: "Raw HTTP GET (no key required)", capabilities: ["fetch"] },
  { providerId: "html2markdown", aliases: [], defaultBaseUrl: "", description: "Local HTML→Markdown via Readability + turndown", capabilities: ["fetch"] },
  { providerId: "playwright", aliases: [], defaultBaseUrl: "", description: "Browser fetch for JS-rendered pages", capabilities: ["fetch"] },
  { providerId: "chatgpt", aliases: ["openai"], defaultBaseUrl: "https://api.openai.com/v1", description: "OpenAI Responses API + web_search tool", capabilities: ["ask"] },
  { providerId: "gemini", aliases: [], defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", description: "Google Gemini + google_search tool", capabilities: ["ask"] },
  { providerId: "claude", aliases: ["anthropic"], defaultBaseUrl: "https://api.anthropic.com", description: "Anthropic Messages + web_search tool", capabilities: ["ask"] },
  { providerId: "grok", aliases: ["xai"], defaultBaseUrl: "https://api.x.ai/v1", description: "xAI Grok + live search", capabilities: ["ask"] },
  { providerId: "deepseek", aliases: [], defaultBaseUrl: "https://api.deepseek.com", description: "DeepSeek chat (no web-search tool)", capabilities: ["ask"] },
  { providerId: "kimi", aliases: ["moonshot"], defaultBaseUrl: "https://api.moonshot.cn/v1", description: "Moonshot Kimi + $web_search builtin", capabilities: ["ask"] },
  { providerId: "volcengine", aliases: ["ark", "doubao"], defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3", description: "Volcengine Ark Doubao (api / agent-plan / coding-plan via base_url)", capabilities: ["ask"] },
  { providerId: "bailian", aliases: ["dashscope", "qwen"], defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", description: "Alibaba Bailian Qwen (api / token-plan / coding-plan via base_url)", capabilities: ["ask"] },
  { providerId: "minimax", aliases: [], defaultBaseUrl: "https://api.minimax.chat/v1", description: "MiniMax chat (api / token-plan via base_url)", capabilities: ["ask"] },
  { providerId: "openrouter", aliases: [], defaultBaseUrl: "https://openrouter.ai/api/v1", description: "OpenRouter multi-LLM + web plugin", capabilities: ["ask"] },
  { providerId: "zai", aliases: ["z.ai", "zhipu-global"], defaultBaseUrl: "https://api.z.ai/api/paas/v4", description: "Z.ai GLM (api / cn-coding-plan / global-coding-plan via base_url)", capabilities: ["ask"] },
  { providerId: "zhipu", aliases: ["bigmodel"], defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4", description: "Zhipu BigModel GLM (mainland)", capabilities: ["ask"] },
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
