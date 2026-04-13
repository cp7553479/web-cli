import { httpJson } from "../core/http";
import { errorLog } from "../core/logger";
import type { AnswerRequest, ProviderContext, ProviderResponse, ResearchRequest } from "../core/types";
import type { AnswerProvider, ResearchProvider } from "./types";
import type { ProviderModelOptions } from "./options";
import { pickWhitelisted } from "./vendor-params";

/** OpenAI-compatible Sonar endpoint (see Perplexity Sonar quickstart). */
const SONAR_URL = "https://api.perplexity.ai/v1/chat/completions";

/** OpenAI-style body keys passed through whitelist B. */
const SONAR_ALLOW = new Set([
  "model",
  "temperature",
  "top_p",
  "max_tokens",
  "presence_penalty",
  "frequency_penalty",
  "search_domain_filter",
  "return_images",
  "return_related_questions",
  "search_recency_filter",
  "web_search_options",
]);

function sonarBody(
  model: string,
  userText: string,
  vendorParams: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const extra = pickWhitelisted(vendorParams, SONAR_ALLOW);
  const { model: _ignored, ...rest } = extra;
  return {
    model,
    messages: [{ role: "user", content: userText }],
    ...rest,
  };
}

export class PerplexitySonarAnswerProvider implements AnswerProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? SONAR_URL;
      const vm = pickWhitelisted(request.vendorParams, SONAR_ALLOW);
      const modelName = (typeof vm.model === "string" && vm.model) || "sonar-pro";
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: sonarBody(modelName, request.query, request.vendorParams),
      });
      const text = (raw as any).choices?.[0]?.message?.content ?? JSON.stringify(raw);
      return {
        provider: this.id,
        items: [{ title: request.query, content: text, source: "perplexity_sonar" }],
        raw,
      };
    } catch (error) {
      errorLog("perplexity.sonar.answer.error", error);
      throw error;
    }
  }
}

/** Sonar deep research: same chat completions path, default model for in-depth research. */
export class PerplexityResearchProvider implements ResearchProvider {
  readonly id: string;
  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async research(request: ResearchRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const endpoint = this.model.baseUrl ?? SONAR_URL;
      const vm = pickWhitelisted(request.vendorParams, SONAR_ALLOW);
      const modelName = (typeof vm.model === "string" && vm.model) || "sonar-deep-research";
      const raw = await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          Authorization: `Bearer ${this.model.apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: sonarBody(modelName, request.query, request.vendorParams),
      });
      const text = (raw as any).choices?.[0]?.message?.content ?? JSON.stringify(raw);
      return {
        provider: this.id,
        items: [{ title: request.query, content: text, source: "perplexity_research" }],
        raw,
      };
    } catch (error) {
      errorLog("perplexity.research.error", error);
      throw error;
    }
  }
}
