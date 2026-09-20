import type { WebPlugin } from "../types";
import { activate as brave } from "./brave";
import {
  activateBailian, activateChatgpt, activateClaude, activateDeepseek, activateGemini,
  activateGrok, activateKimi, activateMinimax, activateOpenrouter, activateVolcengine,
  activateZai,
} from "./llm/vendors";
import { activateZhipu } from "./zhipu";
import { activate as exa } from "./exa";
import { activate as firecrawl } from "./firecrawl";
import { activate as html2markdown } from "./html2markdown";
import { activate as http } from "./http";
import { activate as jina } from "./jina";
import { activate as playwright } from "./playwright";
import { activate as perplexity } from "./perplexity";
import { activate as pexels } from "./pexels";
import { activate as pixabay } from "./pixabay";
import { activate as searxng } from "./searxng";
import { activate as serper } from "./serper";
import { activate as tavily } from "./tavily";

export { PROVIDER_CATALOG, PROVIDER_MODELS, findCatalogEntry } from "./catalog";
export type { ProviderCatalogEntry } from "./catalog";

/**
 * The shipped provider plugins. They register first; external plugins (user,
 * then project) load after and may override a same-named factory. A built-in
 * provider is disabled by setting `providers.<id>.enabled = false` in config —
 * materialize then skips its accounts.
 */
export const BUILTIN_PLUGINS: readonly WebPlugin[] = [
  { id: "brave", activate: brave },
  { id: "tavily", activate: tavily },
  { id: "jina", activate: jina },
  { id: "firecrawl", activate: firecrawl },
  { id: "perplexity", activate: perplexity },
  { id: "exa", activate: exa },
  { id: "serper", activate: serper },
  { id: "searxng", activate: searxng },
  { id: "pixabay", activate: pixabay },
  { id: "pexels", activate: pexels },
  { id: "http", activate: http },
  { id: "html2markdown", activate: html2markdown },
  { id: "playwright", activate: playwright },
  { id: "chatgpt", activate: activateChatgpt },
  { id: "gemini", activate: activateGemini },
  { id: "claude", activate: activateClaude },
  { id: "grok", activate: activateGrok },
  { id: "deepseek", activate: activateDeepseek },
  { id: "kimi", activate: activateKimi },
  { id: "volcengine", activate: activateVolcengine },
  { id: "bailian", activate: activateBailian },
  { id: "minimax", activate: activateMinimax },
  { id: "openrouter", activate: activateOpenrouter },
  { id: "zai", activate: activateZai },
  { id: "zhipu", activate: activateZhipu },
];
