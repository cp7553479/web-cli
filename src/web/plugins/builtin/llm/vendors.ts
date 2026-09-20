import type { PluginHost } from "../../../../core";
import { registerAskVendor } from "./shared";

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

export function activateVolcengine(host: PluginHost): void {
  registerAskVendor(host, {
    name: "volcengine",
    protocol: "openai-chat",
    defaultBase: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6-flash-250615",
    buildTools: () => [{ type: "web_search" }],
  });
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

export function activateMinimax(host: PluginHost): void {
  // MiniMax exposes no documented web-search tool on this endpoint.
  registerAskVendor(host, {
    name: "minimax",
    protocol: "openai-chat",
    defaultBase: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-M2",
  });
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

export function activateZhipu(host: PluginHost): void {
  registerAskVendor(host, {
    name: "zhipu",
    protocol: "openai-chat",
    defaultBase: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6",
    buildTools: () => ZHIPU_WEB_SEARCH_TOOLS,
  });
}
