import type {
  AnswerRequest,
  FetchRequest,
  ProviderContext,
  ProviderResponse,
  SearchRequest,
} from "../core/types";

export interface SearchProvider {
  id: string;
  search(request: SearchRequest, context: ProviderContext): Promise<ProviderResponse>;
}

export interface FetchProvider {
  id: string;
  fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse>;
}

export interface AnswerProvider {
  id: string;
  answer(request: AnswerRequest, context: ProviderContext): Promise<ProviderResponse>;
}

export interface ProviderRegistry {
  getSearch(id: string): SearchProvider | undefined;
  getFetch(id: string): FetchProvider | undefined;
  getAnswer(id: string): AnswerProvider | undefined;
  listSearch(): string[];
  listFetch(): string[];
  listAnswer(): string[];
}

