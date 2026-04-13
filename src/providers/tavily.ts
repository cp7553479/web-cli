import { httpJson } from "../core/http";
import { errorLog } from "../core/logger";
import type {
  AnswerRequest,
  FetchRequest,
  ProviderContext,
  ProviderResponse,
  ResearchRequest,
  SearchRequest,
} from "../core/types";
import type { AnswerProvider, FetchProvider, ResearchProvider, SearchProvider } from "./types";
import type { ProviderModelOptions } from "./options";
import { pickWhitelisted } from "./vendor-params";

const TAVILY_SEARCH = "https://api.tavily.com/search";
const TAVILY_EXTRACT = "https://api.tavily.com/extract";
const TAVILY_RESEARCH = "https://api.tavily.com/research";

/** Official Tavily Search POST body keys (strict whitelist B). */
export const TAVILY_SEARCH_ALLOW = new Set([
  "search_depth",
  "topic",
  "days",
  "max_results",
  "include_domains",
  "exclude_domains",
  "include_answer",
  "include_raw_content",
  "include_images",
  "include_image_descriptions",
  "include_favicon",
  "time_range",
  "start_date",
  "end_date",
  "country",
  "chunks_per_source",
  "auto_parameters",
]);

const TAVILY_EXTRACT_ALLOW = new Set([
  "query",
  "chunks_per_source",
  "extract_depth",
  "include_images",
  "include_favicon",
  "format",
  "timeout",
  "include_usage",
]);

const TAVILY_RESEARCH_ALLOW = new Set(["model", "stream", "citation_format", "output_schema"]);

function buildSearchQuery(request: SearchRequest): string {
  const parts = [request.query];
  if (request.site?.length) {
    for (const site of request.site) parts.push(`site:${site}`);
  }
  return parts.join(" ");
}

function tavilySearchBody(request: SearchRequest): Record<string, unknown> {
  const extra = pickWhitelisted(request.vendorParams, TAVILY_SEARCH_ALLOW);
  const body: Record<string, unknown> = {
    query: buildSearchQuery(request),
    max_results: request.limit,
    ...extra,
  };
  if (!("include_answer" in body)) body.include_answer = false;
  if (request.site?.length && body.include_domains === undefined) {
    body.include_domains = request.site;
  }
  if (request.country && body.country === undefined) {
    body.country = request.country;
  }
  if (request.region && body.country === undefined) {
    body.country = request.region;
  }
  if (request.freshness && body.time_range === undefined) {
    body.time_range = request.freshness;
  }
  return body;
}

export async function postTavilySearch(
  model: ProviderModelOptions,
  request: SearchRequest,
  context: ProviderContext,
): Promise<{ items: ProviderResponse["items"]; raw: unknown }> {
  const endpoint = model.baseUrl ?? TAVILY_SEARCH;
  const raw = await httpJson(endpoint, {
    method: "POST",
    timeoutMs: context.timeoutMs,
    fileLogger: context.fileLogger,
    headers: {
      Authorization: `Bearer ${model.apiToken ?? ""}`,
      "Content-Type": "application/json",
    },
    body: tavilySearchBody(request),
  });
  const answer = (raw as any).answer;
  const results = ((raw as any).results ?? []).map((item: any) => ({
    title: item.title,
    url: item.url,
    content: item.content,
    snippet: item.content,
    source: "tavily",
  }));
  const items = [...results];
  if (answer) {
    items.unshift({
      title: request.query,
      content: typeof answer === "string" ? answer : JSON.stringify(answer),
      source: "tavily_answer",
    });
  }
  return { items, raw };
}

export class TavilySearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const { items, raw } = await postTavilySearch(this.model, request, context);
      return { provider: this.id, items, raw };
    } catch (error) {
      errorLog("tavily.search.error", error);
      throw error;
    }
  }
}

export class TavilyExtractFetchProvider implements FetchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? TAVILY_EXTRACT;
      const extra = pickWhitelisted(request.vendorParams, TAVILY_EXTRACT_ALLOW);
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: {
          urls: request.urls,
          ...extra,
        },
      });
      const rows = ((raw as any).results ?? []) as any[];
      const items = rows.map((row) => ({
        url: row.url as string,
        content: (row.raw_content ?? row.content ?? JSON.stringify(row)) as string,
        source: "tavily_extract" as const,
      }));
      return { provider: this.id, items, raw };
    } catch (error) {
      errorLog("tavily.extract.error", error);
      throw error;
    }
  }
}

export class TavilyAnswerProvider implements AnswerProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const searchReq: SearchRequest = {
        query: request.query,
        limit: 5,
        vendorParams: {
          ...pickWhitelisted(request.vendorParams, TAVILY_SEARCH_ALLOW),
          include_answer: "advanced",
        },
      };
      const { items, raw } = await postTavilySearch(this.model, searchReq, context);
      const answerItem = items.find((i) => i.source === "tavily_answer");
      const rest = items.filter((i) => i.source !== "tavily_answer");
      const outItems = answerItem
        ? [{ title: request.query, content: answerItem.content ?? "", source: "tavily_answer" }]
        : rest.slice(0, 1);
      return { provider: this.id, items: outItems.length ? outItems : items, raw };
    } catch (error) {
      errorLog("tavily.answer.error", error);
      throw error;
    }
  }
}

export class TavilyResearchProvider implements ResearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async research(request: ResearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const base = (this.model.baseUrl ?? "https://api.tavily.com").replace(/\/$/, "");
      const extra = pickWhitelisted(request.vendorParams, TAVILY_RESEARCH_ALLOW);
      const created = (await httpJson(`${base}/research`, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: {
          input: request.query,
          model: extra.model ?? "auto",
          stream: false,
          ...extra,
        },
      })) as Record<string, unknown>;
      const requestId = created.request_id as string | undefined;
      if (!requestId) {
        throw new Error("Tavily research: missing request_id in response");
      }
      const deadline = Date.now() + context.timeoutMs;
      let last: Record<string, unknown> = created;
      while (Date.now() < deadline) {
        const statusRes = (await httpJson(`${base}/research/${encodeURIComponent(requestId)}`, {
          timeoutMs: Math.min(30_000, context.timeoutMs),
          fileLogger: context.fileLogger,
          headers: { Authorization: `Bearer ${this.model.apiToken ?? ""}` },
        })) as Record<string, unknown>;
        last = statusRes;
        const st = statusRes.status as string | undefined;
        if (st === "completed") {
          const content = statusRes.content;
          const text = typeof content === "string" ? content : JSON.stringify(content ?? statusRes);
          return {
            provider: this.id,
            items: [{ title: request.query, content: text, source: "tavily_research" }],
            raw: statusRes,
          };
        }
        if (st === "failed") {
          throw new Error("Tavily research task failed");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      throw new Error(`Tavily research: timeout waiting for ${requestId}`);
    } catch (error) {
      errorLog("tavily.research.error", error);
      throw error;
    }
  }
}
