import { FirecrawlInteractAnswerProvider } from "../providers/firecrawl-interact-answer";
import { GeminiGoogleSearchAnswerProvider } from "../providers/gemini";
import { KimiFetchProvider, KimiSearchProvider } from "../providers/kimi-formula";
import type { ProviderModelOptions } from "../providers/options";
import { PerplexityResearchProvider, PerplexitySonarAnswerProvider } from "../providers/perplexity-sonar";
import {
  BraveAnswerProvider,
  BraveSearchProvider,
  DuckDuckGoAnswerProvider,
  FirecrawlScrapeFetchProvider,
  FirecrawlSearchProvider,
  HttpFetchProvider,
  JinaReaderFetchProvider,
  JinaSearchProvider,
  PerplexitySearchProvider,
} from "../providers/official";
import {
  TavilyAnswerProvider,
  TavilyExtractFetchProvider,
  TavilyResearchProvider,
  TavilySearchProvider,
} from "../providers/tavily";
import { Html2MarkdownFetchProvider } from "../providers/html2markdown";
import { PlaywrightFetchProvider } from "../providers/playwright-fetch";
import type { ProviderModelBinding } from "./protocol";
import type { PluginHost } from "./host";

function toOptions(binding: ProviderModelBinding): ProviderModelOptions {
  return {
    alias: binding.alias,
    provider: binding.model.provider,
    apiToken: binding.model.api_token,
    baseUrl: binding.model.base_url,
  };
}

export function registerBuiltinFactories(host: PluginHost): void {
  host.registerProvider("brave", {
    createSearch: (b) => new BraveSearchProvider(toOptions(b)),
    createAnswer: (b) => new BraveAnswerProvider(toOptions(b)),
  });

  host.registerProvider("tavily", {
    createSearch: (b) => new TavilySearchProvider(toOptions(b)),
    createFetch: (b) => new TavilyExtractFetchProvider(toOptions(b)),
    createAnswer: (b) => new TavilyAnswerProvider(toOptions(b)),
    createResearch: (b) => new TavilyResearchProvider(toOptions(b)),
  });

  host.registerProvider("firecrawl", {
    createSearch: (b) => new FirecrawlSearchProvider(toOptions(b)),
    createFetch: (b) => new FirecrawlScrapeFetchProvider(toOptions(b)),
    createAnswer: (b) => new FirecrawlInteractAnswerProvider(toOptions(b)),
  });

  host.registerProvider("perplexity", {
    createSearch: (b) => new PerplexitySearchProvider(toOptions(b)),
    createAnswer: (b) => new PerplexitySonarAnswerProvider(toOptions(b)),
    createResearch: (b) => new PerplexityResearchProvider(toOptions(b)),
  });

  host.registerProvider("jina", {
    createSearch: (b) => new JinaSearchProvider(toOptions(b)),
    createFetch: (b) => new JinaReaderFetchProvider(toOptions(b)),
  });

  host.registerProvider("kimi", {
    createSearch: (b) => new KimiSearchProvider(toOptions(b)),
    createFetch: (b) => new KimiFetchProvider(toOptions(b)),
  });

  host.registerProvider("http", {
    createFetch: (b) => new HttpFetchProvider(toOptions(b)),
  });

  host.registerProvider("html2markdown", {
    createFetch: (b) => new Html2MarkdownFetchProvider(toOptions(b)),
  });

  host.registerProvider("playwright", {
    createFetch: (b) => new PlaywrightFetchProvider(toOptions(b)),
  });

  host.registerProvider("duckduckgo", {
    createAnswer: (b) => new DuckDuckGoAnswerProvider(toOptions(b)),
  });

  host.registerProvider("gemini", {
    createAnswer: (b) => new GeminiGoogleSearchAnswerProvider(toOptions(b)),
  });
}
