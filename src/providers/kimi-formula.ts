import { httpJson } from "../core/http";
import { errorLog, type FileLogger } from "../core/logger";
import type { FetchRequest, ProviderContext, ProviderResponse, SearchRequest } from "../core/types";
import type { FetchProvider, SearchProvider } from "./types";
import type { ProviderModelOptions } from "./options";

const SEARCH_FORMULA = "moonshot/web-search:latest";
const FETCH_FORMULA = "moonshot/fetch:latest";
const KIMI_MODEL = "kimi-k2.5";
const DEFAULT_MOONSHOT_BASE = "https://api.moonshot.cn/v1";

function moonshotBase(model: ProviderModelOptions): string {
  return (model.baseUrl ?? process.env.MOONSHOT_BASE_URL ?? DEFAULT_MOONSHOT_BASE).replace(/\/$/, "");
}

function formulaSegment(formulaUri: string): string {
  return encodeURIComponent(formulaUri);
}

async function getFormulaTools(
  base: string,
  formulaUri: string,
  apiKey: string,
  timeoutMs: number,
  fileLogger?: FileLogger,
): Promise<unknown[]> {
  const url = `${base}/formulas/${formulaSegment(formulaUri)}/tools`;
  const raw = (await httpJson(url, {
    timeoutMs,
    fileLogger,
    headers: { Authorization: `Bearer ${apiKey}` },
  })) as { tools?: unknown[] };
  return raw.tools ?? [];
}

async function postFiber(
  base: string,
  formulaUri: string,
  apiKey: string,
  name: string,
  argumentsJson: string,
  timeoutMs: number,
  fileLogger?: FileLogger,
): Promise<Record<string, unknown>> {
  const url = `${base}/formulas/${formulaSegment(formulaUri)}/fibers`;
  return (await httpJson(url, {
    method: "POST",
    timeoutMs,
    fileLogger,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: { name, arguments: argumentsJson },
  })) as Record<string, unknown>;
}

function toolContentFromFiber(fiber: Record<string, unknown>): string {
  const ctx = fiber.context as Record<string, unknown> | undefined;
  if (!ctx) return JSON.stringify(fiber);
  const enc = ctx.encrypted_output;
  if (typeof enc === "string" && enc.length > 0) return enc;
  const out = ctx.output;
  if (typeof out === "string") return out;
  if (out !== undefined) return JSON.stringify(out);
  return JSON.stringify(fiber);
}

async function runFormulaChat(args: {
  base: string;
  apiKey: string;
  formulaUri: string;
  userText: string;
  timeoutMs: number;
  fileLogger?: FileLogger;
}): Promise<{ text: string; rawTrace: unknown[] }> {
  const { base, apiKey, formulaUri, userText, timeoutMs, fileLogger } = args;
  const tools = await getFormulaTools(base, formulaUri, apiKey, timeoutMs, fileLogger);
  const toolToUri: Record<string, string> = {};
  for (const t of tools) {
    const fn = (t as { function?: { name?: string } }).function;
    const n = fn?.name;
    if (n) toolToUri[n] = formulaUri;
  }
  const allTools = tools;

  const messages: Record<string, unknown>[] = [
    {
      role: "user",
      content: userText,
    },
  ];

  const rawTrace: unknown[] = [];
  let safety = 0;
  while (safety++ < 24) {
    const raw = (await httpJson(`${base}/chat/completions`, {
      method: "POST",
      timeoutMs,
      fileLogger,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: KIMI_MODEL,
        messages,
        tools: allTools,
      },
    })) as Record<string, unknown>;
    rawTrace.push(raw);

    const choice = (raw.choices as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;
    const msg = choice?.message as Record<string, unknown> | undefined;
    const finish = choice?.finish_reason as string | undefined;
    const toolCalls = msg?.tool_calls as Record<string, unknown>[] | undefined;

    if (finish === "tool_calls" && toolCalls?.length) {
      const assistantRound: Record<string, unknown> = {
        role: "assistant",
        content: msg?.content ?? null,
        tool_calls: toolCalls,
      };
      if (msg?.reasoning_content != null) {
        assistantRound.reasoning_content = msg.reasoning_content;
      }
      messages.push(assistantRound);

      for (const tc of toolCalls) {
        const id = tc.id as string;
        const fn = tc.function as { name?: string; arguments?: string } | undefined;
        const name = fn?.name ?? "";
        const argStr = fn?.arguments ?? "{}";
        const uri = toolToUri[name];
        if (!uri) {
          throw new Error(`Kimi Formula: 未找到工具 ${name} 对应的 formula URI`);
        }
        const fiber = await postFiber(base, uri, apiKey, name, argStr, timeoutMs, fileLogger);
        rawTrace.push(fiber);
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: toolContentFromFiber(fiber),
        });
      }
      continue;
    }

    const content = msg?.content;
    const text = typeof content === "string" ? content : JSON.stringify(content ?? raw);
    return { text, rawTrace };
  }

  throw new Error("Kimi Formula: 超过最大 tool 轮次");
}

function buildSearchQuery(request: SearchRequest): string {
  const parts = [request.query];
  if (request.site?.length) {
    for (const site of request.site) parts.push(`site:${site}`);
  }
  return parts.join(" ");
}

export class KimiSearchProvider implements SearchProvider {
  readonly id: string;

  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const base = moonshotBase(this.model);
      const apiKey = this.model.apiToken ?? "";
      const userText = `请使用官方联网检索工具回答。查询：${buildSearchQuery(request)}。请在最终回复中整理至多 ${request.limit} 条相关要点，并尽量包含可点击来源或 URL。`;
      const { text, rawTrace } = await runFormulaChat({
        base,
        apiKey,
        formulaUri: SEARCH_FORMULA,
        userText,
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
      });
      const out: ProviderResponse = {
        provider: this.id,
        items: [{ title: request.query, content: text, source: "kimi_search" }],
        raw: { trace: rawTrace },
      };
      return out;
    } catch (error) {
      errorLog("kimi.search.error", error);
      throw error;
    }
  }
}

export class KimiFetchProvider implements FetchProvider {
  readonly id: string;

  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const base = moonshotBase(this.model);
      const apiKey = this.model.apiToken ?? "";
      const lines = request.urls.map((u) => `- ${u}`).join("\n");
      const userText = `请使用官方 fetch 工具抓取以下 URL 的正文（优先 Markdown），逐个处理：\n${lines}`;
      const { text, rawTrace } = await runFormulaChat({
        base,
        apiKey,
        formulaUri: FETCH_FORMULA,
        userText,
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
      });
      const items = request.urls.map((url) => ({
        url,
        content: text,
        source: "kimi_fetch" as const,
      }));
      const out: ProviderResponse = {
        provider: this.id,
        items,
        raw: { trace: rawTrace },
      };
      return out;
    } catch (error) {
      errorLog("kimi.fetch.error", error);
      throw error;
    }
  }
}
