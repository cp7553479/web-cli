import { httpJson } from "../core/http";
import { AppError } from "../core/errors";
import { errorLog } from "../core/logger";
import type { AnswerRequest, ProviderContext, ProviderResponse } from "../core/types";
import type { AnswerProvider } from "./types";
import type { ProviderModelOptions } from "./options";
import { pickWhitelisted } from "./vendor-params";

const INTERACT_ALLOW = new Set(["prompt", "code", "schema"]);

export class FirecrawlInteractAnswerProvider implements AnswerProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    if (!request.url?.trim()) {
      throw new AppError(
        "Firecrawl interact requires --url <page> (official flow: scrape then interact).",
        "FIRECRAWL_INTERACT_NO_URL",
      );
    }
    try {
      const base = (this.model.baseUrl ?? "https://api.firecrawl.dev").replace(/\/$/, "");
      const scrapeRaw = await httpJson(`${base}/v2/scrape`, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: { url: request.url, formats: ["markdown"] },
      });
      const scrapeId = (scrapeRaw as any).data?.metadata?.scrapeId ?? (scrapeRaw as any).data?.metadata?.scrape_id;
      if (!scrapeId) {
        throw new AppError("Firecrawl scrape response missing scrapeId in data.metadata", "FIRECRAWL_NO_SCRAPE_ID");
      }
      const interactBody = {
        prompt: request.query,
        ...pickWhitelisted(request.vendorParams, INTERACT_ALLOW),
      };
      const raw = await httpJson(`${base}/v2/scrape/${encodeURIComponent(String(scrapeId))}/interact`, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: interactBody,
      });
      const text =
        (raw as any).output ??
        (raw as any).data?.output ??
        (raw as any).message ??
        JSON.stringify(raw);
      const out = typeof text === "string" ? text : JSON.stringify(text);
      return {
        provider: this.id,
        items: [{ title: request.query, content: out, url: request.url, source: "firecrawl_interact" }],
        raw,
      };
    } catch (error) {
      errorLog("firecrawl.interact.answer.error", error);
      throw error;
    }
  }
}
