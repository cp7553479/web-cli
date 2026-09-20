import { ensureSuccess, parseJsonBody, resolveBaseUrl } from "../shared";
import type { TransportResult } from "../../../../core";
import { makeFactory, makeInstance } from "../factory";
import type { PluginHost, ProviderBinding, ProviderHooks, TransportRequest } from "../../../../core";
import type { AskRequest, ProviderResponse } from "../../../protocol/types";

/**
 * Fixed instruction injected into every `web ask` request: force live web
 * search, numbered inline citations, and a "Sources:" block at the end.
 */
export const ASK_INSTRUCTIONS =
  "Use the web_search tool to search the web and answer the user's question. " +
  "Cite sources inline with numbered references like [1], [2]. " +
  'At the end, add a "Sources:" section listing every source you used, one per line, ' +
  'in this exact format: "[N] <title> - <URL>".';

export type AskProtocol = "openai-chat" | "openai-responses" | "gemini" | "anthropic";

export interface AskVendorSpec {
  name: string;
  protocol: AskProtocol;
  defaultBase: string;
  defaultModel: string;
  /** Web-search tool array for the request body (undefined = provider has no tool). */
  buildTools?: () => unknown[] | undefined;
  /** Extra top-level body fields (e.g. search_parameters, plugins, enable_search). */
  extraBody?: (req: AskRequest) => Record<string, unknown>;
  /** System-role injection where the protocol supports it (openai-chat). */
  systemRole?: boolean;
}

type AnyHooks = ProviderHooks<AskRequest, ProviderResponse>;

function modelFor(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): string {
  return req.model ?? binding.fields?.model ?? spec.defaultModel;
}

function openAIChatRequest(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): TransportRequest {
  const base = resolveBaseUrl(binding.baseUrl, spec.defaultBase);
  const body: Record<string, unknown> = {
    model: modelFor(req, binding, spec),
    messages: [
      ...(spec.systemRole === false ? [] : [{ role: "system", content: ASK_INSTRUCTIONS }]),
      { role: "user", content: spec.systemRole === false ? `${ASK_INSTRUCTIONS}\n\n${req.question}` : req.question },
    ],
    max_tokens: 4096,
    ...spec.extraBody?.(req),
  };
  const tools = spec.buildTools?.();
  if (tools) body.tools = tools;
  return {
    method: "POST",
    url: `${base}/chat/completions`,
    headers: { Authorization: `Bearer ${binding.apiToken ?? ""}` },
    json: body,
  };
}

function openAIResponsesRequest(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): TransportRequest {
  const base = resolveBaseUrl(binding.baseUrl, spec.defaultBase);
  const body: Record<string, unknown> = {
    model: modelFor(req, binding, spec),
    input: [{
      role: "user",
      content: [{ type: "input_text", text: `${ASK_INSTRUCTIONS}\n\n${req.question}` }],
    }],
    ...spec.extraBody?.(req),
  };
  const tools = spec.buildTools?.();
  if (tools) body.tools = tools;
  return {
    method: "POST",
    url: `${base}/responses`,
    headers: { Authorization: `Bearer ${binding.apiToken ?? ""}` },
    json: body,
  };
}

function geminiRequest(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): TransportRequest {
  const base = resolveBaseUrl(binding.baseUrl, spec.defaultBase);
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: `${ASK_INSTRUCTIONS}\n\n${req.question}` }] }],
    ...spec.extraBody?.(req),
  };
  const tools = spec.buildTools?.();
  if (tools) body.tools = tools;
  return {
    method: "POST",
    url: `${base}/models/${modelFor(req, binding, spec)}:generateContent`,
    headers: { "x-goog-api-key": binding.apiToken ?? "" },
    json: body,
  };
}

function anthropicRequest(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): TransportRequest {
  const base = resolveBaseUrl(binding.baseUrl, spec.defaultBase);
  const body: Record<string, unknown> = {
    model: modelFor(req, binding, spec),
    max_tokens: 4096,
    messages: [{ role: "user", content: `${ASK_INSTRUCTIONS}\n\n${req.question}` }],
    ...spec.extraBody?.(req),
  };
  const tools = spec.buildTools?.();
  if (tools) body.tools = tools;
  return {
    method: "POST",
    url: `${base}/v1/messages`,
    headers: {
      "x-api-key": binding.apiToken ?? "",
      "anthropic-version": "2023-06-01",
    },
    json: body,
  };
}

function buildRequestFor(req: AskRequest, binding: ProviderBinding, spec: AskVendorSpec): TransportRequest {
  switch (spec.protocol) {
    case "openai-chat": return openAIChatRequest(req, binding, spec);
    case "openai-responses": return openAIResponsesRequest(req, binding, spec);
    case "gemini": return geminiRequest(req, binding, spec);
    case "anthropic": return anthropicRequest(req, binding, spec);
  }
}

function parseAnswer(protocol: AskProtocol, provider: string, result: TransportResult): ProviderResponse {
  ensureSuccess(provider, result);
  const parsed = parseJsonBody(provider, result) as Record<string, unknown>;
  let answer = "";
  if (protocol === "openai-chat") {
    const content = (parsed as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    answer = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c) => (c as { text?: string }).text ?? "").join("")
        : "";
  } else if (protocol === "openai-responses") {
    const output = (parsed as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
    answer = output
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? "")
      .join("");
  } else if (protocol === "gemini") {
    const parts = (parsed as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts ?? [];
    answer = parts.map((p) => p.text ?? "").join("");
  } else {
    const blocks = (parsed as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
    answer = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  }
  return { provider, items: [{ title: "answer", content: answer, source: provider }], raw: parsed };
}

/** Builds a typed ask instance for one vendor spec (any of the four protocols). */
export function createAskInstance(binding: ProviderBinding, spec: AskVendorSpec) {
  const hooks: AnyHooks = {
    buildRequest(req): TransportRequest {
      return buildRequestFor(req, binding, spec);
    },
    parseResponse(result): ProviderResponse {
      return parseAnswer(spec.protocol, binding.alias, result);
    },
  };
  return makeInstance(binding, hooks);
}

/** Registers one ask vendor under its name with the standard ask capability. */
export function registerAskVendor(host: PluginHost, spec: AskVendorSpec): void {
  host.registerFactory(spec.name, makeFactory(["ask"], { ask: (binding) => createAskInstance(binding, spec) }));
}
