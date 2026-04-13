import { httpJson } from "../core/http";
import { errorLog } from "../core/logger";
import type { AnswerRequest, FetchRequest, ProviderContext, ProviderResponse, SearchRequest } from "../core/types";
import type { ProviderModelOptions } from "./options";
import type { AnswerProvider, FetchProvider, SearchProvider } from "./types";

export type { ProviderModelOptions } from "./options";

export class BraveSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const query = buildSearchQuery(request);
      const endpoint = this.model.baseUrl ?? "https://api.search.brave.com/res/v1/web/search";
      const url = `${endpoint}?q=${encodeURIComponent(query)}&count=${request.limit}`;
      const raw = await httpJson(url, {
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: { "X-Subscription-Token": this.model.apiToken ?? "" },
      });
      const results = ((raw as any).web?.results ?? []).map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        source: "brave",
      }));
      const out = { provider: this.id, items: results, raw };
      return out;
    } catch (error) {
      errorLog("brave.search.error", error);
      throw error;
    }
  }
}

export class TavilyProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://api.tavily.com/search";
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: {
          query: buildSearchQuery(request),
          max_results: request.limit,
          include_answer: false,
        },
      });
      const items = ((raw as any).results ?? []).map((item: any) => ({
        title: item.title,
        url: item.url,
        content: item.content,
        snippet: item.content,
        source: "tavily",
      }));
      const out = { provider: this.id, items, raw };
      return out;
    } catch (error) {
      errorLog("tavily.search.error", error);
      throw error;
    }
  }
}

export class FirecrawlSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://api.firecrawl.dev/v2/search";
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: {
          query: buildSearchQuery(request),
          limit: request.limit,
        },
      });
      const data = (raw as any).data ?? (raw as any).results ?? [];
      const items = data.map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.description ?? item.markdown,
        source: "firecrawl_search",
      }));
      const out = { provider: this.id, items, raw };
      return out;
    } catch (error) {
      errorLog("firecrawl.search.error", error);
      throw error;
    }
  }
}

export class PerplexitySearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://api.perplexity.ai/search";
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: {
          query: buildSearchQuery(request),
          max_results: request.limit,
        },
      });
      const items = ((raw as any).results ?? []).map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet ?? item.text,
        source: "perplexity_search",
      }));
      const out = { provider: this.id, items, raw };
      return out;
    } catch (error) {
      errorLog("perplexity.search.error", error);
      throw error;
    }
  }
}

export class JinaSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://s.jina.ai/";
      const url = `${endpoint}?q=${encodeURIComponent(buildSearchQuery(request))}`;
      const raw = await httpJson(url, {
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: this.model.apiToken ? { Authorization: `Bearer ${this.model.apiToken}` } : undefined,
      });
      const items = normalizeJinaSearch(raw);
      const out = { provider: this.id, items, raw };
      return out;
    } catch (error) {
      errorLog("jina.search.error", error);
      throw error;
    }
  }
}

export class HttpFetchProvider implements FetchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const items = [];
      for (const url of request.urls) {
        const raw = await httpJson(url, { timeoutMs: context.timeoutMs, fileLogger: context.fileLogger });
        items.push({ url, content: JSON.stringify(raw), source: "http" });
      }
      const out = { provider: this.id, items };
      return out;
    } catch (error) {
      errorLog("http.fetch.error", error);
      throw error;
    }
  }
}

export class JinaReaderFetchProvider implements FetchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const items = [];
      for (const url of request.urls) {
        const endpoint = `${this.model.baseUrl ?? "https://r.jina.ai/http://"}${url.replace(/^https?:\/\//, "")}`;
        const raw = await httpJson(endpoint, {
          timeoutMs: context.timeoutMs,
          fileLogger: context.fileLogger,
          headers: this.model.apiToken ? { Authorization: `Bearer ${this.model.apiToken}` } : undefined,
        });
        items.push({ url, content: JSON.stringify(raw), source: "jina_reader" });
      }
      const out = { provider: this.id, items };
      return out;
    } catch (error) {
      errorLog("jina.fetch.error", error);
      throw error;
    }
  }
}

export class FirecrawlScrapeFetchProvider implements FetchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://api.firecrawl.dev/v2/scrape";
      const items = [];
      for (const url of request.urls) {
        const raw = await httpJson(endpoint, {
          method: "POST",
          timeoutMs: context.timeoutMs,
          fileLogger: context.fileLogger,
          headers: {
            Authorization: `Bearer ${this.model.apiToken ?? ""}`,
            "Content-Type": "application/json",
          },
          body: { url, formats: ["markdown"] },
        });
        items.push({
          url,
          content: (raw as any).data?.markdown ?? JSON.stringify(raw),
          source: "firecrawl_scrape",
        });
      }
      const out = { provider: this.id, items };
      return out;
    } catch (error) {
      errorLog("firecrawl.fetch.error", error);
      throw error;
    }
  }
}

export class DuckDuckGoAnswerProvider implements AnswerProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const url =
        `https://api.duckduckgo.com/?format=json&q=${encodeURIComponent(request.query)}` +
        `&no_redirect=${request.noRedirect ? "1" : "0"}` +
        `&no_html=${request.noHtml ? "1" : "0"}` +
        `&skip_disambig=${request.skipDisambig ? "1" : "0"}`;
      const raw = await httpJson(url, { timeoutMs: context.timeoutMs, fileLogger: context.fileLogger });
      const out = {
        provider: this.id,
        items: [
          {
            title: (raw as any).Heading,
            content: (raw as any).AbstractText,
            url: (raw as any).AbstractURL,
            source: "duckduckgo_instant",
          },
        ],
        raw,
      };
      return out;
    } catch (error) {
      errorLog("ddg.answer.error", error);
      throw error;
    }
  }
}

export class BraveAnswerProvider implements AnswerProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }
  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? "https://api.search.brave.com/res/v1/answers/search";
      const url = `${endpoint}?q=${encodeURIComponent(request.query)}`;
      const raw = await httpJson(url, {
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: { "X-Subscription-Token": this.model.apiToken ?? "" },
      });
      const data = (raw as any).answers ?? (raw as any).results ?? [];
      const out = {
        provider: this.id,
        items: data.map((item: any) => ({
          title: item.title ?? item.name,
          content: item.description ?? item.answer,
          url: item.url,
          source: "brave_answer",
        })),
        raw,
      };
      return out;
    } catch (error) {
      errorLog("brave.answer.error", error);
      throw error;
    }
  }
}

function buildSearchQuery(request: SearchRequest): string {
  const parts = [request.query];
  if (request.site?.length) {
    for (const site of request.site) parts.push(`site:${site}`);
  }
  return parts.join(" ");
}

function normalizeJinaSearch(raw: unknown): ProviderResponse["items"] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => ({
      title: (entry as any).title,
      url: (entry as any).url,
      content: (entry as any).content,
      source: "jina_search",
    }));
  }
  if ((raw as any).data && Array.isArray((raw as any).data)) {
    return (raw as any).data.map((entry: any) => ({
      title: entry.title,
      url: entry.url,
      content: entry.content,
      source: "jina_search",
    }));
  }
  return [{ content: JSON.stringify(raw), source: "jina_search" }];
}

