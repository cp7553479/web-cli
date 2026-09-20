import type { PluginHost } from "../../../../core";
import { makeFactory, makeInstance } from "../factory";
import { ensureSuccess, parseJsonBody, resolveBaseUrl } from "../shared";
import { createAskInstance, registerAskVendor } from "./shared";
import type { ProviderBinding, ProviderHooks, TransportRequest } from "../../../../core";
import type { ProviderResponse, SearchRequest } from "../../../protocol/types";

/**
 * All built-in LLM vendors for `web ask`. Plans (agent-plan / coding-plan /
 * token-plan / …) are the same vendor with a different `base_url` + `model`,
 * configured per account — no extra plugins needed.
 */

const ZHIPU_WEB_SEARCH_TOOLS = [
  { type: "web_search", web_search: { enable: true } },
];

export function activateChatgpt(host: PluginHost): void {
  registerAskVendor(host, {
    name: "chatgpt",
    protocol: "openai-responses",
    defaultBase: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    buildTools: () => [{ type: "web_search" }],
  });
}

export function activateGemini(host: PluginHost): void {
  registerAskVendor(host, {
    name: "gemini",
    protocol: "gemini",
    defaultBase: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-flash-latest",
    buildTools: () => [{ google_search: {} }],
  });
}

export function activateClaude(host: PluginHost): void {
  registerAskVendor(host, {
    name: "claude",
    protocol: "anthropic",
    defaultBase: "https://api.anthropic.com",
    defaultModel: "claude-haiku-4-5",
    buildTools: () => [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
  });
}

export function activateGrok(host: PluginHost): void {
  registerAskVendor(host, {
    name: "grok",
    protocol: "openai-chat",
    defaultBase: "https://api.x.ai/v1",
    defaultModel: "grok-4-fast",
  });
}

export function activateDeepseek(host: PluginHost): void {
  // DeepSeek exposes no web-search tool; ask answers from model knowledge only.
  registerAskVendor(host, {
    name: "deepseek",
    protocol: "openai-chat",
    defaultBase: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  });
}

export function activateKimi(host: PluginHost): void {
  registerAskVendor(host, {
    name: "kimi",
    protocol: "openai-chat",
    defaultBase: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k3",
    buildTools: () => [{ type: "builtin_function", function: { name: "$web_search" } }],
  });
}

function createVolcengineSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, "https://ark.cn-beijing.volces.com/api/v3");
      return {
        method: "POST",
        url: `${base}/chat/completions`,
        headers: { Authorization: `Bearer ${binding.apiToken ?? ""}` },
        json: {
          model: binding.fields?.model ?? "doubao-seed-1-6-flash-250615",
          messages: [{ role: "user", content: req.query }],
          tools: [{ type: "web_search" }],
        },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("Volcengine", result);
      const parsed = parseJsonBody("Volcengine", result) as {
        choices?: Array<{
          message?: {
            content?: unknown;
            annotations?: Array<{ type?: string; title?: string; url?: string }>;
          };
        }>;
      };
      const message = parsed.choices?.[0]?.message ?? {};
      const content = typeof message.content === "string" ? message.content : "";
      const items = (message.annotations ?? [])
        .filter((a) => (a.type ?? "url_citation") && a.url)
        .map((a) => ({ title: a.title, url: a.url, snippet: content.slice(0, 0), source: "volcengine" }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activateVolcengine(host: PluginHost): void {
  host.registerFactory(
    "volcengine",
    makeFactory(["ask", "search"], {
      ask: (binding) =>
        createAskInstance(binding, {
          name: "volcengine",
          protocol: "openai-chat",
          defaultBase: "https://ark.cn-beijing.volces.com/api/v3",
          defaultModel: "doubao-seed-1-6-flash-250615",
          buildTools: () => [{ type: "web_search" }],
        }),
      search: createVolcengineSearch,
    }),
  );
}

export function activateBailian(host: PluginHost): void {
  registerAskVendor(host, {
    name: "bailian",
    protocol: "openai-chat",
    defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-flash",
    extraBody: () => ({ enable_search: true }),
  });
}

function createMinimaxSearch(binding: ProviderBinding) {
  const hooks: ProviderHooks<SearchRequest, ProviderResponse> = {
    buildRequest(req): TransportRequest {
      const base = resolveBaseUrl(binding.baseUrl, "https://api.minimax.chat/anthropic");
      return {
        method: "POST",
        url: `${base}/v1/messages`,
        headers: {
          "x-api-key": binding.apiToken ?? "",
          "anthropic-version": "2023-06-01",
        },
        json: {
          model: binding.fields?.model ?? "MiniMax-M2",
          max_tokens: 1024,
          messages: [{ role: "user", content: req.query }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        },
      };
    },
    parseResponse(result): ProviderResponse {
      ensureSuccess("MiniMax", result);
      const parsed = parseJsonBody("MiniMax", result) as {
        content?: Array<{
          type?: string;
          content?: Array<{ type?: string; title?: string; url?: string }>;
        }>;
      };
      const items = (parsed.content ?? [])
        .filter((b) => b.type === "web_search_tool_result")
        .flatMap((b) => b.content ?? [])
        .map((r) => ({ title: r.title, url: r.url, source: "minimax" }));
      return { provider: binding.alias, items, raw: parsed };
    },
  };
  return makeInstance(binding, hooks);
}

export function activateMinimax(host: PluginHost): void {
  host.registerFactory(
    "minimax",
    makeFactory(["ask", "search"], {
      ask: (binding) =>
        createAskInstance(binding, {
          name: "minimax",
          protocol: "openai-chat",
          defaultBase: "https://api.minimax.chat/v1",
          defaultModel: "MiniMax-M2",
        }),
      search: createMinimaxSearch,
    }),
  );
}

export function activateOpenrouter(host: PluginHost): void {
  registerAskVendor(host, {
    name: "openrouter",
    protocol: "openai-chat",
    defaultBase: "https://openrouter.ai/api/v1",
    defaultModel: "moonshotai/kimi-k2.6",
    extraBody: () => ({ plugins: [{ id: "web" }] }),
  });
}

export function activateZai(host: PluginHost): void {
  registerAskVendor(host, {
    name: "zai",
    protocol: "openai-chat",
    defaultBase: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-4.5-flash",
    buildTools: () => ZHIPU_WEB_SEARCH_TOOLS,
  });
}

