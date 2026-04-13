import type {
  AnswerProvider,
  FetchProvider,
  ProviderRegistry,
  ResearchProvider,
  SearchProvider,
} from "./types";

export class InMemoryProviderRegistry implements ProviderRegistry {
  private searchMap = new Map<string, SearchProvider>();
  private fetchMap = new Map<string, FetchProvider>();
  private answerMap = new Map<string, AnswerProvider>();
  private researchMap = new Map<string, ResearchProvider>();

  registerSearch(provider: SearchProvider): this {
    this.searchMap.set(provider.id, provider);
    return this;
  }

  registerFetch(provider: FetchProvider): this {
    this.fetchMap.set(provider.id, provider);
    return this;
  }

  registerAnswer(provider: AnswerProvider): this {
    this.answerMap.set(provider.id, provider);
    return this;
  }

  registerResearch(provider: ResearchProvider): this {
    this.researchMap.set(provider.id, provider);
    return this;
  }

  getSearch(id: string): SearchProvider | undefined {
    return this.searchMap.get(id);
  }

  getFetch(id: string): FetchProvider | undefined {
    return this.fetchMap.get(id);
  }

  getAnswer(id: string): AnswerProvider | undefined {
    return this.answerMap.get(id);
  }

  getResearch(id: string): ResearchProvider | undefined {
    return this.researchMap.get(id);
  }

  listSearch(): string[] {
    return [...this.searchMap.keys()];
  }

  listFetch(): string[] {
    return [...this.fetchMap.keys()];
  }

  listAnswer(): string[] {
    return [...this.answerMap.keys()];
  }

  listResearch(): string[] {
    return [...this.researchMap.keys()];
  }
}

