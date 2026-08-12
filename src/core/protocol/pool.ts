import { AppError, errorMessage } from "../errors";
import type { Logger } from "../logger/logger";
import type { Transport } from "../transport/transport";
import { ProviderError } from "./classification";
import type { FailureClass } from "./classification";
import type { ProviderHooks, ProviderInstance } from "./provider";
import type { ProviderRegistry } from "./registry";
import type { HookCtx, PoolRunOptions } from "./types";

export interface ProviderPoolOptions {
  /** Per-attempt hard timeout forwarded to hooks/transport. */
  timeoutMs?: number;
  logger?: Logger;
  /**
   * Returns the preferred account alias for a segment (from `current.json`).
   * When set and present, that account is tried first; the rest follow in
   * declared order as failover candidates.
   */
  preferred?: (segment: string) => string | undefined;
}

/**
 * The coordinator. Given a typed request, resolves ordered candidate provider
 * instances for a segment, dispatches the build→transport→parse lifecycle per
 * instance, and routes failures through the {@link FailureClass} taxonomy to
 * decide whether to advance the pointer (try the next account) or stop.
 *
 * One pool serves one capability segment type; domains instantiate a pool per
 * segment (`ProviderPool<SearchRequest, SearchResponse>`,
 * `ProviderPool<FetchRequest, FetchResponse>`).
 */
export class ProviderPool<Req, Res> {
  constructor(
    private readonly registry: ProviderRegistry<Req, Res>,
    private readonly transport: Transport,
    private readonly options: ProviderPoolOptions = {},
  ) {}

  async run(req: Req, opts: PoolRunOptions): Promise<Res> {
    const candidates = this.resolveCandidates(opts);
    if (candidates.length === 0) {
      throw new AppError(
        `${opts.segment}: no accounts configured under [${opts.segment}.account.*].`,
        `${opts.segment.toUpperCase()}_NO_ACCOUNTS`,
      );
    }

    const attempts: Array<{ id: string; provider: string; classification: FailureClass; message: string }> = [];
    let lastError: unknown;

    for (const instance of candidates) {
      const ctx: HookCtx = {
        account: instance.account,
        timeoutMs: this.options.timeoutMs ?? 0,
        logger: this.options.logger,
      };
      try {
        // Self-contained providers (e.g. browser fetch) bypass the transport.
        if (instance.hooks.execute) {
          return await instance.hooks.execute(req, ctx);
        }
        const buildRequest = instance.hooks.buildRequest;
        const parseResponse = instance.hooks.parseResponse;
        if (!buildRequest || !parseResponse) {
          // Misconfigured factory: skip rather than burn the pool.
          throw new AppError(
            `Provider '${instance.providerName}' (${instance.id}) has neither execute nor buildRequest+parseResponse hooks.`,
            "PROVIDER_MISCONFIGURED",
          );
        }
        const transportRequest = await buildRequest(req, ctx);
        const result = await this.transport.execute(transportRequest);
        return await parseResponse(result, req, ctx);
      } catch (error) {
        lastError = error;
        const classification = classifyFailure(error, instance.hooks, ctx);
        attempts.push({
          id: instance.id,
          provider: instance.providerName,
          classification,
          message: errorMessage(error),
        });
        this.options.logger?.log("pool.attempt", attempts.at(-1));
        // Always advance to the next configured account. We deliberately do NOT
        // short-circuit on "non-retryable-request": HTTP status codes are an
        // unreliable signal (e.g. Brave returns 422 for invalid-token auth
        // errors, which are account-specific and should rotate). Trying every
        // configured account is simple, correct, and gives a full diagnostic
        // trail in the ALL_FAILED details.
      }
    }

    throw new AppError(
      `${opts.segment}: all configured accounts failed.`,
      `${opts.segment.toUpperCase()}_ALL_FAILED`,
      {
        attempts,
        lastMessage: lastError instanceof Error ? lastError.message : String(lastError),
      },
    );
  }

  /** Resolves the ordered candidate list per SPEC §3.2/§7.3. */
  private resolveCandidates(opts: PoolRunOptions): ProviderInstance<Req, Res>[] {
    const all = this.registry.list(opts.segment);
    const ids = all.map((i) => i.id);
    const providerTypes = [...new Set(all.map((i) => i.providerName))];
    const availableHint = [...ids, ...providerTypes.filter((t) => !ids.includes(t))].join(", ");

    if (opts.forcedAccount) {
      const inst = all.find((i) => i.id === opts.forcedAccount);
      if (!inst) {
        throw new AppError(
          `Account id '${opts.forcedAccount}' not found for ${opts.segment}. Available: ${availableHint || "(none)"}`,
          "ACCOUNT_NOT_FOUND",
        );
      }
      if (opts.forcedProvider && inst.providerName !== opts.forcedProvider) {
        throw new AppError(
          `Account '${opts.forcedAccount}' uses provider '${inst.providerName}', not '${opts.forcedProvider}'.`,
          "ACCOUNT_PROVIDER_MISMATCH",
        );
      }
      return [inst];
    }

    if (opts.forcedProvider) {
      const aliasMatch = all.find((i) => i.id === opts.forcedProvider);
      if (aliasMatch) return [aliasMatch];
      const typed = all.filter((i) => i.providerName === opts.forcedProvider);
      if (typed.length === 0) {
        throw new AppError(
          `Unsupported provider '${opts.forcedProvider}' for ${opts.segment}. Available: ${availableHint || "(none)"}`,
          "PROVIDER_NOT_FOUND",
        );
      }
      return typed;
    }

    const preferredId = this.options.preferred?.(opts.segment);
    if (preferredId) {
      const preferred = all.find((i) => i.id === preferredId);
      if (preferred) {
        return [preferred, ...all.filter((i) => i.id !== preferredId)];
      }
    }
    return all;
  }
}

/**
 * Classification precedence (the "internal exception identifier" decision):
 *   1. `ProviderError` carries its own class → use it.
 *   2. provider hook `classifyFailure` (if any) → use it (provider gets a look).
 *   3. core transport error (code starts with `TRANSPORT_`) → retryable-transport.
 *   4. otherwise → unknown (safe default that advances the pointer).
 */
function classifyFailure<Req, Res>(
  error: unknown,
  hooks: ProviderHooks<Req, Res>,
  ctx: HookCtx,
): FailureClass {
  if (error instanceof ProviderError) return error.classification;
  if (hooks.classifyFailure) {
    try {
      return hooks.classifyFailure(error, ctx);
    } catch {
      // a faulty classifier must never mask the original error
    }
  }
  if (error instanceof AppError && error.code.startsWith("TRANSPORT_")) {
    return "retryable-transport";
  }
  return "unknown";
}
