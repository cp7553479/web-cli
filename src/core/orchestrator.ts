import type { GroupName, WebConfig } from "../config/types";
import { resolveForcedAccountOrder } from "../config";
import type { ProviderRegistry } from "../providers/types";
import { AppError } from "./errors";
import type {
  AnswerRequest,
  FetchRequest,
  ProviderContext,
  ProviderResponse,
  SearchRequest,
} from "./types";

export class Orchestrator {
  constructor(
    private readonly config: WebConfig,
    private readonly registry: ProviderRegistry,
    private readonly context: ProviderContext,
  ) {}

  private silentFailover(label: string, error: unknown): void {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.context.fileLogger?.log(label, msg);
  }

  validateProviders(groupName: GroupName, names: string[]): void {
    const group = this.config[groupName];
    const available = Object.keys(group.account);
    const providerTypes = [...new Set(Object.values(group.account).map((m) => m.provider))];
    for (const name of names) {
      if (group.account[name]) continue;
      if (Object.values(group.account).some((m) => m.provider === name)) continue;
      const all = [...available, ...providerTypes.filter((t) => !available.includes(t))];
      throw new AppError(
        `Unsupported provider '${name}'. Available for ${groupName}: ${all.join(", ")}`,
        "PROVIDER_NOT_FOUND",
      );
    }
  }

  async search(
    request: SearchRequest,
    forcedProvider?: string,
    forcedAccount?: string,
  ): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("search", forcedProvider, forcedAccount);
    let lastError: unknown;
    for (const alias of aliases) {
      const provider = this.registry.getSearch(alias);
      if (!provider) continue;
      try {
        const out = await provider.search(request, this.context);
        return out;
      } catch (error) {
        lastError = error;
        this.silentFailover(`orchestrator.search.provider_failed:${alias}`, error);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : "no provider available";
    throw new AppError(
      `All search providers failed: ${reason}\n  Tip: check .web/logs under the process cwd (when runtime logging is on) and run web config list.`,
      "SEARCH_ALL_FAILED",
    );
  }

  async searchMulti(request: SearchRequest, providers: string[]): Promise<ProviderResponse> {
    const tasks = providers.map(async (name) => {
      const aliases = this.resolveCandidates("search", name);
      for (const alias of aliases) {
        const provider = this.registry.getSearch(alias);
        if (!provider) continue;
        return provider.search(request, this.context);
      }
      throw new AppError(`No registered search provider for: ${name}`, "PROVIDER_NOT_FOUND");
    });
    return this.mergeMulti(tasks, "search");
  }

  async fetch(request: FetchRequest, forcedProvider?: string, forcedAccount?: string): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("fetch", forcedProvider, forcedAccount);
    let lastError: unknown;
    for (const alias of aliases) {
      const provider = this.registry.getFetch(alias);
      if (!provider) continue;
      try {
        const out = await provider.fetch(request, this.context);
        return out;
      } catch (error) {
        lastError = error;
        this.silentFailover(`orchestrator.fetch.provider_failed:${alias}`, error);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : "no provider available";
    throw new AppError(
      `All fetch providers failed: ${reason}\n  Tip: check .web/logs under the process cwd; adjust --provider / --account or reorder [fetch.account.*].`,
      "FETCH_ALL_FAILED",
    );
  }

  async answer(
    request: AnswerRequest,
    forcedProvider?: string,
    forcedAccount?: string,
  ): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("answer", forcedProvider, forcedAccount);
    let lastError: unknown;
    for (const alias of aliases) {
      const provider = this.registry.getAnswer(alias);
      if (!provider) continue;
      try {
        const out = await provider.answer(request, this.context);
        return out;
      } catch (error) {
        lastError = error;
        this.silentFailover(`orchestrator.answer.provider_failed:${alias}`, error);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : "no provider available";
    throw new AppError(
      `All answer providers failed: ${reason}\n  Tip: check .web/logs under the process cwd (when runtime logging is on) and run web config list.`,
      "ANSWER_ALL_FAILED",
    );
  }

  async answerMulti(request: AnswerRequest, providers: string[]): Promise<ProviderResponse> {
    const tasks = providers.map(async (name) => {
      const aliases = this.resolveCandidates("answer", name);
      for (const alias of aliases) {
        const provider = this.registry.getAnswer(alias);
        if (!provider) continue;
        return provider.answer(request, this.context);
      }
      throw new AppError(`No registered answer provider for: ${name}`, "PROVIDER_NOT_FOUND");
    });
    return this.mergeMulti(tasks, "answer");
  }

  async research(
    query: string,
    maxSources: number,
    forcedProvider?: string,
    forcedAccount?: string,
  ): Promise<ProviderResponse> {
    const searchResult = await this.search({ query, limit: maxSources }, forcedProvider, forcedAccount);
    const urls = searchResult.items.map((item) => item.url).filter((url): url is string => Boolean(url)).slice(0, maxSources);
    if (urls.length === 0) return searchResult;
    const fetched = await this.fetch({ urls });
    const merged = {
      provider: `research(${searchResult.provider}+${fetched.provider})`,
      items: [
        {
          title: query,
          content: fetched.items.map((item) => `${item.url ?? ""}\n${item.content ?? item.snippet ?? ""}`).join("\n\n"),
          source: "research",
        },
      ],
      raw: { search: searchResult.raw, fetch: fetched.raw },
    };
    return merged;
  }

  async researchMulti(
    query: string,
    maxSources: number,
    providers: string[],
  ): Promise<ProviderResponse> {
    const searchResult = await this.searchMulti({ query, limit: maxSources }, providers);
    const urls = searchResult.items.map((item) => item.url).filter((url): url is string => Boolean(url)).slice(0, maxSources);
    if (urls.length === 0) return searchResult;
    const fetched = await this.fetch({ urls });
    const merged = {
      provider: `research(${searchResult.provider}+${fetched.provider})`,
      items: [
        {
          title: query,
          content: fetched.items.map((item) => `${item.url ?? ""}\n${item.content ?? item.snippet ?? ""}`).join("\n\n"),
          source: "research",
        },
      ],
      raw: { search: searchResult.raw, fetch: fetched.raw },
    };
    return merged;
  }

  private async mergeMulti(
    tasks: Promise<ProviderResponse>[],
    label: string,
  ): Promise<ProviderResponse> {
    const settled = await Promise.allSettled(tasks);
    const succeeded: ProviderResponse[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") {
        succeeded.push(r.value);
      } else {
        this.silentFailover(`orchestrator.${label}Multi.provider_failed`, r.reason);
      }
    }
    if (succeeded.length === 0) {
      throw new AppError(
        `All ${label} providers failed in multi-source mode.\n  Tip: check .web/logs under the process cwd (when runtime logging is on) and run web config list.`,
        `${label.toUpperCase()}_ALL_FAILED`,
      );
    }
    const providerNames = succeeded.map((r) => r.provider).join("+");
    const items = succeeded.flatMap((r) => r.items);
    const raw = succeeded.map((r) => ({ provider: r.provider, raw: r.raw }));
    const out: ProviderResponse = { provider: providerNames, items, raw };
    return out;
  }

  private resolveCandidates(
    groupName: "search" | "fetch" | "answer",
    forcedProvider?: string,
    forcedAccount?: string,
  ): string[] {
    return resolveForcedAccountOrder(this.config[groupName], groupName, {
      vendorOrAlias: forcedProvider,
      accountId: forcedAccount,
    });
  }
}
