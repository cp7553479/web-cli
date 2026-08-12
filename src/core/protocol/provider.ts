import type { FailureClass } from "./classification";
import type {
  AccountCredentials,
  HookCtx,
  ProviderBinding,
  TransportRequest,
  TransportResult,
} from "./types";

/**
 * Lifecycle hooks a provider registers with the coordinator. Providers do NOT
 * call the transport or other providers directly; they either:
 *   - declare {@link ProviderHooks.buildRequest} + {@link ProviderHooks.parseResponse}
 *     (HTTP providers — the pool runs the transport between them), OR
 *   - declare {@link ProviderHooks.execute} (self-contained providers that do not
 *     use the HTTP transport, e.g. a browser-driven fetch).
 *
 * HTTP lifecycle for one attempt:
 *   1. {@link ProviderHooks.buildRequest} — typed Req → TransportRequest
 *   2. transport.execute(...)
 *   3. {@link ProviderHooks.parseResponse} — TransportResult → typed Res
 *
 * On any thrown error, the pool consults {@link ProviderHooks.classifyFailure}
 * (unless the error is already a `ProviderError` carrying its own class).
 */
export interface ProviderHooks<Req, Res> {
  /** Typed Req → TransportRequest. Required for HTTP providers. */
  buildRequest?(req: Req, ctx: HookCtx): Promise<TransportRequest> | TransportRequest;
  /** TransportResult → typed Res. Required for HTTP providers. */
  parseResponse?(result: TransportResult, req: Req, ctx: HookCtx): Promise<Res> | Res;
  /**
   * Self-contained execution for providers that bypass the HTTP transport (e.g.
   * a headless browser). When present, the pool calls this instead of
   * buildRequest → transport → parseResponse.
   */
  execute?(req: Req, ctx: HookCtx): Promise<Res> | Res;
  /**
   * Optional. Maps a thrown error (other than a self-tagged `ProviderError`) to
   * a {@link FailureClass}. When omitted, untagged errors classify as `unknown`.
   */
  classifyFailure?(error: unknown, ctx: HookCtx): FailureClass;
}

/**
 * A materialized provider for one capability segment, bound to one account.
 * `id` is the account alias and is what the pool uses as its pointer.
 */
export interface ProviderInstance<Req, Res> {
  id: string;
  providerName: string;
  account: AccountCredentials;
  hooks: ProviderHooks<Req, Res>;
}

/**
 * Factory registered under a provider name (e.g. "tavily"). Declares which
 * capability segments it can build and produces a {@link ProviderInstance} per
 * account binding.
 *
 * The generic instance type is erased here (the domain's materialize function
 * narrows it back to the segment-specific `ProviderInstance<Req, Res>`).
 */
export interface ProviderFactory {
  capabilities: string[];
  create(capability: string, binding: ProviderBinding): ProviderInstance<unknown, unknown>;
}
