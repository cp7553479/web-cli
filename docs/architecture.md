# Architecture

This document describes the layering of `web` and the public interface of the
portable `src/core/` abstraction layer. Requirements live in
[`../SPEC.md`](../SPEC.md); this file explains *how* those requirements are
structured in code.

## 1. Layer overview

```
 bin: web (dist/index.js)
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│ DOMAIN  src/web/   (web-cli specific; depends on core)       │
│                                                              │
│  cli/commands/{search,fetch,config,provider}.ts              │
│  protocol/{types,requests}.ts   SearchRequest/FetchRequest   │
│  config/{schema,defaults,materialize}.ts                     │
│  providers/{brave,tavily,jina,firecrawl,perplexity,          │
│             http,html2markdown,playwright}.ts                │
│  output/render.ts            item → json/markdown/text       │
│  plugins/external.ts         ~/.web/plugins loader            │
└──────────────────────────────┬───────────────────────────────┘
                               │ imports (one-way)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ CORE    src/core/   (portable; ZERO upward dependencies)     │
│                                                              │
│  protocol/   FailureClass, ProviderHooks, ProviderInstance,  │
│              ProviderRegistry<Req,Res>, ProviderPool<Req,Res>│
│              PluginHost                                      │
│  transport/  Transport interface + CurlTransport             │
│  config/     appName-parameterized loader + {$ENV} resolver  │
│  cli/        commander program builder + error boundary      │
│  output/     truncate / injectWrap / stringifyJson           │
│  logger/     Logger interface + FileLogger                   │
│  errors.ts   AppError                                        │
└──────────────────────────────────────────────────────────────┘
        depends only on: itself + commander (+ node builtins + curl)
```

**The rule:** arrows point down. `src/web/**` may import from `src/core/**`;
`src/core/**` may never import from `src/web/**`. Core is generic over
`<Req, Res>` and never names a capability.

## 2. Request lifecycle (one `web search` call)

```
commander parses → search command action
   │
   ├─ buildSearchRequest()  (domain: validate + shape SearchRequest)
   │
   ▼  context.ts builds:
      config  = loadWebConfig()                  // core loader + domain schema
      pools   = materializePools(config)         // 2 typed pools: search, fetch
      logger  = new FileLogger()
   │
   ▼  searchPool.run(request, { forcedAccount, forcedProvider })
   ┌─────────────────────────────────────────────────────────┐
   │ ProviderPool<SearchRequest, SearchResponse>.run:        │
   │   candidates = resolveCandidates(segment, config,       │
   │                                    current.json, opts)  │
   │   for inst of candidates:                               │
   │     req  = inst.hooks.buildRequest(request)             │
   │     res  = transport.execute(req)                       │
   │     try return inst.hooks.parseResponse(res, request)   │
   │     catch e:                                            │
   │       cls = inst.hooks.classifyFailure?.(e) ?? "unknown"│
   │       logger.log("pool.attempt", {id, cls})             │
   │       continue   // always rotate to next account       │
   │   throw AppError("SEARCH_ALL_FAILED")                   │
   └─────────────────────────────────────────────────────────┘
   │
   ▼  render(response, format, maxLength, injectBefore, injectAfter)
   ▼  stdout
```

## 3. core public surface

### 3.1 Errors & classification — `core/errors.ts`, `core/protocol/classification.ts`

```ts
class AppError extends Error {
  constructor(message: string, code: string, details?: unknown);
  readonly code: string;
  readonly details?: unknown;
}

type FailureClass =
  | "retryable-credential"
  | "retryable-transport"
  | "non-retryable-request"
  | "unsupported"
  | "unknown";

class ProviderError extends AppError {
  constructor(classification: FailureClass, message: string, details?: unknown);
  readonly classification: FailureClass;
}
```

`FailureClass` is the **internal exception identifier** the pool uses to decide
whether to advance its pointer.

### 3.2 Transport — `core/transport/`

```ts
interface TransportRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;        // mutually exclusive with form
  form?: Array<{ name: string; value?: string; filePath?: string; filename?: string; contentType?: string }>;
  timeoutMs?: number;
}
interface TransportResult {
  statusCode: number;
  headers: Record<string, string>;
  bodyText: string;
}
interface Transport { execute(req: TransportRequest): Promise<TransportResult>; }

class CurlTransport implements Transport { ... }   // spawn curl
```

### 3.3 Protocol — `core/protocol/`

```ts
interface HookCtx {
  account: { alias: string; apiToken?: string; baseUrl?: string };
  timeoutMs: number;
  logger?: Logger;
}

interface ProviderHooks<Req, Res> {
  buildRequest(req: Req, ctx: HookCtx): Promise<TransportRequest> | TransportRequest;
  parseResponse(res: TransportResult, req: Req, ctx: HookCtx): Promise<Res> | Res;
  classifyFailure?(error: unknown, ctx: HookCtx): FailureClass;
}

interface ProviderInstance<Req, Res> {
  id: string;            // account alias
  providerName: string;  // factory name
  hooks: ProviderHooks<Req, Res>;
}

interface ProviderRegistry<Req, Res> {
  register(segment: string, inst: ProviderInstance<Req, Res>): void;
  list(segment: string): ProviderInstance<Req, Res>[];
  get(segment: string, id: string): ProviderInstance<Req, Res> | undefined;
}

interface PoolRunOptions {
  segment: string;
  forcedAccount?: string;
  forcedProvider?: string;
}

class ProviderPool<Req, Res> {
  constructor(registry, resolver, transport, logger?);
  run(req: Req, opts: PoolRunOptions): Promise<{ provider: string; items: unknown[]; raw?: unknown }>;
}

interface ProviderFactory {
  capabilities: string[];   // ["search"] | ["fetch"] | ["search","fetch"]
  create(capability: string, binding: ProviderBinding): ProviderInstance<unknown, unknown>;
}
interface ProviderBinding { alias: string; providerName: string; apiToken?: string; baseUrl?: string; }

interface PluginHost {
  registerFactory(name: string, factory: ProviderFactory): void;
  getFactory(name: string): ProviderFactory | undefined;
  listFactories(): string[];
}
```

> The pool is instantiated **per capability** in the domain:
> `new ProviderPool<SearchRequest, SearchResponse>(searchRegistry, …)` and
> `new ProviderPool<FetchRequest, FetchResponse>(fetchRegistry, …)`. Both reuse
> the exact same generic class — this is what "capability-orthogonal
> registration" means in code.

### 3.4 Config — `core/config/`

```ts
interface ConfigValidator<T> { validate(raw: unknown): T; }   // domain supplies

function loadAppConfig<T>(opts: {
  appName: string;          // ".web"
  validator: ConfigValidator<T>;
  env?: Record<string, string | undefined>;
  cwd?: string;
}): T;

function getAppPaths(appName: string, cwd?: string): {
  globalRoot: string;       // ~/.web
  globalConfig: string;     // ~/.web/config.json
  globalCurrent: string;    // ~/.web/current.json
  globalEnv: string;        // ~/.web/.env
  projectRoot?: string;     // ./.web (when it exists)
  projectConfig?: string;
  projectCurrent?: string;
  projectEnv?: string;
  logsDir: string;          // project .web/logs if project exists else ~/.web/logs
};
```

Core provides the **mechanism** (read, deep-merge per known segment keys,
resolve `{$ENV}`, validate via injected validator). The **schema** is domain-
supplied, so core ships no knowledge of `search`/`fetch`.

### 3.5 CLI / output / logger — small and generic

- `core/cli/program.ts` — `createProgram({ name, version, description, globalFlags })`
  returns a commander `Command` with a uniform error boundary that prints
  `AppError` cleanly and sets `process.exitCode = 1`.
- `core/output/primitives.ts` — `truncate(text, max)`, `injectWrap(body, before, after)`,
  `stringifyJson(value)`. No item rendering.
- `core/logger/logger.ts` — `Logger` interface + `FileLogger` (writes to
  `<logsDir>/<date>-<id>.log`).

## 4. Why this split

- **Portability:** `src/core/` can be copied into image-cli (or any future
  "N providers + pool + curl" CLI) unchanged. It depends on nothing web-
  specific.
- **Clarity:** the protocol layer is the single place that owns request
  dispatch, failure taxonomy, and pool-pointer movement. Providers are dumb
  hook bundles; commands are thin adapters.
- **Testability:** core's pool/classification/transport/config are pure-ish
  and unit-testable with mocks; only domain providers + the CLI boundary need
  integration tests.
