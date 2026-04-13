import type { ModelConfig } from "../config/types";
import type { AnswerProvider, FetchProvider, ResearchProvider, SearchProvider } from "../providers/types";

export interface ProviderModelBinding {
  alias: string;
  model: ModelConfig;
}

export interface ProviderFactory {
  createSearch?(binding: ProviderModelBinding): SearchProvider;
  createFetch?(binding: ProviderModelBinding): FetchProvider;
  createAnswer?(binding: ProviderModelBinding): AnswerProvider;
  createResearch?(binding: ProviderModelBinding): ResearchProvider;
}

export interface PluginRegistrationApi {
  registerProvider(name: string, factory: ProviderFactory): void;
}

export interface WebPlugin {
  id: string;
  version?: string;
  activate(api: PluginRegistrationApi): void;
}
