import type { GroupName, WebConfig } from "../config/types";
import { resolveForcedAccountOrder } from "../config";
import type { ProviderRegistry } from "../providers/types";
import { AppError } from "./errors";
import type {
  AnswerRequest,
  FetchRequest,
  ProviderContext,
  ProviderResponse,
  ResearchRequest,
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
    if (aliases.length === 0) {
      throw new AppError(
        `search: no accounts configured under [search.account.*].`,
        "SEARCH_NO_ACCOUNTS",
      );
    }
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
      `search: all configured accounts failed or do not support search for this request (${reason}).\n  Tip: check .web/logs and [search.account.*]; unsupported providers are skipped.`,
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
      throw new AppError(`search: no registered provider for: ${name}`, "PROVIDER_NOT_FOUND");
    });
    return this.mergeMulti(tasks, "search");
  }

  async fetch(request: FetchRequest, forcedProvider?: string, forcedAccount?: string): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("fetch", forcedProvider, forcedAccount);
    if (aliases.length === 0) {
      throw new AppError(`fetch: no accounts configured under [fetch.account.*].`, "FETCH_NO_ACCOUNTS");
    }
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
      `fetch: all configured accounts failed or do not support fetch (${reason}).\n  Tip: check .web/logs and [fetch.account.*].`,
      "FETCH_ALL_FAILED",
    );
  }

  async answer(
    request: AnswerRequest,
    forcedProvider?: string,
    forcedAccount?: string,
  ): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("answer", forcedProvider, forcedAccount);
    if (aliases.length === 0) {
      throw new AppError(`answer: no accounts configured under [answer.account.*].`, "ANSWER_NO_ACCOUNTS");
    }
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
      `answer: all configured accounts failed or do not support answer (${reason}).\n  Tip: check .web/logs and [answer.account.*].`,
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
      throw new AppError(`answer: no registered provider for: ${name}`, "PROVIDER_NOT_FOUND");
    });
    return this.mergeMulti(tasks, "answer");
  }

  async research(
    request: ResearchRequest,
    forcedProvider?: string,
    forcedAccount?: string,
  ): Promise<ProviderResponse> {
    const aliases = this.resolveCandidates("research", forcedProvider, forcedAccount);
    if (aliases.length === 0) {
      throw new AppError(
        `research: no accounts configured under [research.account.*]. Add an account whose provider exposes the official research API (e.g. tavily, perplexity).`,
        "RESEARCH_NO_ACCOUNTS",
      );
    }
    let lastError: unknown;
    let anyRegistered = false;
    for (const alias of aliases) {
      const provider = this.registry.getResearch(alias);
      if (!provider) continue;
      anyRegistered = true;
      try {
        return await provider.research(request, this.context);
      } catch (error) {
        lastError = error;
        this.silentFailover(`orchestrator.research.provider_failed:${alias}`, error);
      }
    }
    if (!anyRegistered) {
      const providers = [...new Set(aliases.map((id) => this.config.research.account[id]?.provider).filter(Boolean))];
      throw new AppError(
        `research: configured account(s) use provider(s) that do not support the official research API: ${providers.join(", ") || "unknown"}. Use [research.account.*] with provider tavily or perplexity (see README).`,
        "RESEARCH_UNSUPPORTED_PROVIDER",
      );
    }
    const reason = lastError instanceof Error ? lastError.message : "no provider available";
    throw new AppError(
      `research: all configured research accounts failed (${reason}).\n  Tip: check .web/logs and [research.account.*].`,
      "RESEARCH_ALL_FAILED",
    );
  }

  async researchMulti(request: ResearchRequest, providers: string[]): Promise<ProviderResponse> {
    const tasks = providers.map(async (name) => {
      const aliases = this.resolveCandidates("research", name);
      for (const alias of aliases) {
        const provider = this.registry.getResearch(alias);
        if (!provider) continue;
        return provider.research(request, this.context);
      }
      throw new AppError(`research: no registered research provider for: ${name}`, "PROVIDER_NOT_FOUND");
    });
    return this.mergeMulti(tasks, "research");
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
    groupName: GroupName,
    forcedProvider?: string,
    forcedAccount?: string,
  ): string[] {
    return resolveForcedAccountOrder(this.config[groupName], groupName, {
      vendorOrAlias: forcedProvider,
      accountId: forcedAccount,
    });
  }
}
