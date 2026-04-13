import { httpJson } from "../core/http";
import { errorLog } from "../core/logger";
import type { AnswerRequest, ProviderContext, ProviderResponse } from "../core/types";
import type { ProviderModelOptions } from "./options";
import type { AnswerProvider } from "./types";

const DEFAULT_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Gemini generateContent + google_search 工具（官方 REST），解析 groundingMetadata。
 * 密钥来自 config 解析后的 api_token（通常绑定 {$GEMINI_API_KEY}）。
 */
export class GeminiGoogleSearchAnswerProvider implements AnswerProvider {
  readonly id: string;

  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse> {
    const apiKey = this.model.apiToken ?? "";
    const endpoint = this.model.baseUrl?.trim() || DEFAULT_GENERATE_URL;
    const body = {
      contents: [{ role: "user", parts: [{ text: request.query }] }],
      tools: [{ google_search: {} }],
    };
    try {
      const raw = (await httpJson(endpoint, {
        method: "POST",
        timeoutMs: context.timeoutMs,
        fileLogger: context.fileLogger,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
      })) as Record<string, unknown>;

      const candidates = raw.candidates as Record<string, unknown>[] | undefined;
      const cand = candidates?.[0] as Record<string, unknown> | undefined;
      const content = cand?.content as Record<string, unknown> | undefined;
      const parts = (content?.parts as { text?: string }[]) ?? [];
      const text = parts.map((p) => p.text ?? "").join("") || JSON.stringify(raw);

      const gm = cand?.groundingMetadata as Record<string, unknown> | undefined;
      const chunks = (gm?.groundingChunks as Record<string, unknown>[]) ?? [];
      const itemsFromChunks = chunks
        .map((ch) => {
          const web = ch.web as Record<string, unknown> | undefined;
          const uri = web?.uri as string | undefined;
          const title = web?.title as string | undefined;
          if (!uri && !title) return null;
          return { title, url: uri, snippet: title, source: "gemini_google_search" as const };
        })
        .filter(Boolean) as ProviderResponse["items"];

      const items: ProviderResponse["items"] = [
        { title: "answer", content: text, source: "gemini_google_search" },
        ...itemsFromChunks,
      ];

      const out: ProviderResponse = { provider: this.id, items, raw };
      return out;
    } catch (error) {
      errorLog("gemini.answer.error", error);
      throw error;
    }
  }
}
