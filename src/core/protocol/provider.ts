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
 * One selectable option inside a provider config field. `value` is what gets
 * written to config.json; `fields` opens a nested level when this option is
 * picked (hierarchical menus).
 */
export interface ProviderConfigOption {
  label: string;
  value: string;
  fields?: ProviderConfigField[];
}

/**
 * Declares ONE account field a provider understands — this is the whole
 * schema standard, shared by menu-time and runtime:
 *
 * - Menu time (`web config add`): `label` + `options` render the menu; the
 *   picked option's `value` (or a free-text answer) becomes the value.
 * - Runtime: the value is written flat into the account entry under `key`
 *   and handed to the factory via `ProviderBinding.fields[key]`.
 *
 * There is no second schema to keep in sync: what the menu writes is exactly
 * what the runtime reads.
 */
export interface ProviderConfigField {
  /** Account key in config.json (flat string value), e.g. "base_url". */
  key: string;
  label: string;
  /** When present the user picks one option; when absent the field is free text. */
  options?: ProviderConfigOption[];
  /** Pre-selected option value / placeholder answer. */
  default?: string;
}

/**
 * Factory registered under a provider name (e.g. "tavily"). Declares which
 * capability segments it can build and produces a {@link ProviderInstance} per
 * account binding. `config` optionally declares the account fields the user
 * can pick in `web config add` (multiple base URLs, models, ...).
 *
 * The generic instance type is erased here (the domain's materialize function
 * narrows it back to the segment-specific `ProviderInstance<Req, Res>`).
 */
export interface ProviderFactory {
  capabilities: string[];
  create(capability: string, binding: ProviderBinding): ProviderInstance<unknown, unknown>;
  /** Account fields declared by this provider (drives `web config add`). */
  config?: ProviderConfigField[];
}
