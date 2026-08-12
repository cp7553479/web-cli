# web-cli SPEC

> Status: authoritative requirements document. Any change to commands, flags,
> config shape, provider behavior, or the core boundary MUST update this file
> first. Implementation follows this spec, not the reverse.

## 1. Goal

One local CLI, `web`, that turns web **search** and web **fetch** into reusable,
agent-friendly infrastructure. The CLI is built on a **portable abstraction
layer (`src/core/`)** so the same architecture can be lifted into other domains
(e.g. image generation) without rewriting the plumbing.

v1 public commands:

- `web search <query>`
- `web fetch <url...>`
- `web config <subcommand>`
- `web provider <subcommand>`

## 2. Design Principles

1. **Official APIs only.** Only providers backed by official API docs or
   official public endpoints. No scraping of proprietary frontends.
2. **HTTP direct, no SDK.** Talk to providers over HTTP via the system `curl`
   binary. Do not pull in official SDKs.
3. **No implicit black-box fallback.** Every failover decision is explicit and
   observable. "Silent retry of everything" is not allowed — failures are
   classified and the pool pointer moves only on classifications that justify
   it (see §10).
4. **core is portable.** `src/core/**` has zero upward dependencies. It never
   imports from `src/web/**`. Porting to another domain = copying `src/core/`.
5. **Minimal dependencies.** Prefer Node built-ins + `curl` over libraries.
   Libraries are admitted only when a built-in cannot do the job
   (`commander` = CLI, `linkedom` = DOM for html2markdown, `playwright` =
   optional browser fetch).
6. **Agent-friendly output.** Default output is bounded and structured.
   Secrets, raw requests, and raw responses never reach default stdout.
7. **Config is data.** Configuration lives in JSON files under `~/.web`
   (project-overridable). Keys may be inline or `{$ENV}` references.

## 3. CLI Grammar

```
web --help
web --version
web <command> [options]

web search <query> [options]
web fetch <url...> [options]

web config init [--force]
web config path
web config show [--json]
web config list
web config set <group> <alias> --provider <p> [--token <t>] [--base-url <u>] [--enabled <bool>]
web remove <group> <alias>            (alias: web config remove-model)
web config use <group> <alias>
web config doctor [--json]

web provider list [--json]
web provider <provider-id> models [--json]
```

### 3.1 Global flags (apply to `search` and `fetch`)

| Flag | Values | Default | Notes |
|---|---|---|---|
| `-f, --format` | `json` \| `markdown` \| `text` | `text` | output format |
| `--max-length <n>` | positive int | `10000` | hard char cap on rendered output |
| `--timeout-ms <n>` | positive int | `15000` | per-request timeout (curl `--max-time`) |

### 3.2 `web search`

```
web search <query>
  [--site <domain...>]            # domain include filter (repeatable / multi)
  [--country <code>]              # unified country hint, mapped per provider
  [--freshness day|week|month|year]
  [--limit <n>]                   # result count (default 5)
  [--language <code>]
  [--safesearch <level>]
  [--provider <aliasOrName>]      # pin one account or provider type
  [--account <alias>]             # pin one account id (validates provider match)
  [--vendor <key=value>...]       # provider-native params (allowlist-filtered)
```

- Without `--provider`/`--account`, accounts under `[search]` are tried in
  declared order (failover). The active default account from `current.json`
  (see §7) is tried first when set.
- `--provider <name>` resolves to either an account alias or all accounts of a
  provider type, in declared order.
- Unknown trailing `--key value` / `--key=value` are merged into vendor params
  (explicit `--vendor` wins on key collision); only allowlisted keys reach the
  provider API.

### 3.3 `web fetch`

```
web fetch <url...>
  [--provider <aliasOrName>]
  [--account <alias>]
  [--selector <css>]              # extract a DOM region (playwright / html2markdown)
  [--wait-until load|domcontentloaded|networkidle]   # playwright only
```

- Same failover/`--account` semantics as `search`, over `[fetch]` accounts.
- When rendered output exceeds the fetch char limit (`100_000`), it is written
  to `./.web/temp/<timestamp>.md` and stdout prints the file path.

### 3.4 `web config`

- `init` — non-interactively copy the `init/` template (`config.json`,
  `.env.example`, skills) into `~/.web`. `--force` overwrites an existing
  `config.json`. Also syncs the bundled skill to existing agent skill
  directories on the machine.
- `path` — print resolved config / current / logs paths.
- `show [--json]` — sanitized resolved config (keys masked). `--json` emits raw
  JSON.
- `list` — list configured accounts per group with masked keys (human text).
- `set <group> <alias> --provider <p> ...` — upsert an account entry.
- `remove <group> <alias>` — delete an account entry.
- `use <group> <alias>` — write the active default account for a group into
  `current.json` (see §7).
- `doctor [--json]` — self-check: config exists & parses, every account's
  provider has a registered factory, curl is on PATH, `{$ENV}` references
  resolve. Reports problems; non-zero exit if any hard failure.

### 3.5 `web provider`

- `list [--json]` — list built-in + plugin provider ids, aliases, default base
  URL, declared capabilities.
- `<provider-id> models [--json]` — list known models for a provider (built-in
  list; no live discovery in v1).

## 4. Request / Response Model

```ts
// protocol layer (domain types — live in src/web, NOT in core)
interface SearchRequest {
  query: string;
  site?: string[];
  limit: number;
  freshness?: "day" | "week" | "month" | "year";
  language?: string;
  country?: string;
  safesearch?: string | number;
  vendorParams?: Record<string, unknown>;
}

interface FetchRequest {
  urls: string[];
  selector?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  vendorParams?: Record<string, unknown>;
}

interface ResultItem {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  source?: string;
  raw?: unknown;
}

interface ProviderResponse {
  provider: string;            // account alias (or "a+b" after merge)
  items: ResultItem[];
  raw?: unknown;               // preserved for diagnostics; never in default stdout
}
```

The protocol layer owns: enum/numeric validation, building the typed request
from CLI options, and CLI-spelling → request-field conversion. Provider
implementations own: auth, URL construction, request-body translation, response
parsing, and failure classification. Validation completes **before** transport.

## 5. Provider Capability Model

Two orthogonal capability segments: **`search`** and **`fetch`**. Each account
is declared under exactly one segment. A provider factory may implement either
or both segments; an account is only materialized for a segment if its
provider factory implements that segment.

Provider × capability matrix (v1):

| Provider   | search | fetch | Notes |
|------------|:------:|:-----:|-------|
| brave      |   ✓    |       | `X-Subscription-Token` |
| tavily     |   ✓    |   ✓   | search `/search` + extract `/extract` |
| jina       |   ✓    |   ✓   | `s.jina.ai` (search) + `r.jina.ai` (reader) |
| firecrawl  |   ✓    |   ✓   | **v2** `/v2/search` + `/v2/scrape` |
| perplexity |   ✓    |       | `/v1/sonar`; returns grounded answer + `search_results[]` |
| http       |        |   ✓   | raw curl GET, returns body |
| html2markdown |     |   ✓   | curl GET → Readability → turndown |
| playwright |        |   ✓   | optional dep; only way to render SPAs |

Not supported in v1 (and why):

- **Moonshot/Kimi** — no standalone search API; only grounded chat with
  encrypted payloads. Not a `{title,url,snippet}` source. Revisit if a real
  search endpoint ships.

### Verified provider contracts (summary; full detail in `docs/provider-apis.md`)

- **Tavily** — `POST https://api.tavily.com/search` and `.../extract`,
  `Authorization: Bearer tvly-…`, no `/v1` prefix. Search response `results[]`
  has `title/url/content/score/raw_content`; `answer` appears when
  `include_answer` is set. Extract response `results[]` uses `raw_content`;
  failures in `failed_results[]`.
- **Brave** — `GET https://api.search.brave.com/res/v1/web/search`,
  `X-Subscription-Token` header. Params include `q/count/country/search_lang/
  freshness/safesearch/extra_snippets`. Use `goggles` (not the deprecated
  `goggles_id`). Results in `web.results[]`; ranked order in `mixed`.
- **Jina search** — `GET https://s.jina.ai/<query>`, `Authorization: Bearer`.
  JSON mode `data` is an **array** of up to 5 `{title,url,content}`.
- **Jina reader** — `GET https://r.jina.ai/<url>`, `Authorization: Bearer`,
  format header `x-respond-with` (NOT `X-Return-Format`), wait header
  `x-wait-for-selector`. JSON mode `data` is a single object.
- **Firecrawl v2** — `POST https://api.firecrawl.dev/v2/search` and
  `/v2/scrape`, `Authorization: Bearer`. Search response keyed by source:
  `data.web[]/images[]/news[]`; no `timeRange`/`lang` (use `tbs`/`country`).
- **Perplexity** — `POST https://api.perplexity.ai/v1/sonar`
  (`/chat/completions` alias), `Authorization: Bearer`. Models:
  `sonar`, `sonar-pro`, `sonar-reasoning-pro`, `sonar-deep-research`.
  Citations are top-level; `search_results[]` carries `{title,url,snippet}`.

## 6. Config Model

### 6.1 Files & precedence

```
~/.web/config.json        global config (source of truth; shareable)
~/.web/current.json       active-account pointer (runtime state; mutable)
~/.web/logs/*.log         runtime logs (when logging enabled)
~/.web/plugins/<id>/      external plugins
./.web/config.json        project overlay (merged onto global)
./.web/current.json       project active-account pointer
./.web/logs/              project logs (used when ./.web exists)
./.web/temp/              large-fetch output spillover
```

Merge rules:

1. Parse `~/.web/config.json` (created from `init/` template on first run).
2. If `./.web/config.json` exists, deep-merge per-segment (`search`/`fetch`):
   overlay keys win; `account` maps are unioned with overlay entries winning on
   alias collision. `runtime` is shallow-merged.
3. Resolve `{$ENV}` tokens in `api_token` against `process.env` →
   `~/.web/.env` → `./.web/.env` (later sources win).

### 6.2 `config.json` shape

```json
{
  "runtime": { "logging": true },
  "search": {
    "inject_before": "",
    "inject_after": "",
    "account": {
      "tavily-main": {
        "provider": "tavily",
        "api_token": "{$TAVILY_API_KEY}",
        "base_url": "https://api.tavily.com",
        "enabled": true
      }
    }
  },
  "fetch": {
    "inject_before": "",
    "inject_after": "",
    "account": {
      "jina-reader": {
        "provider": "jina",
        "api_token": "jina_...",
        "enabled": true
      }
    }
  }
}
```

- `provider` MUST match a factory registered by built-in or plugin code.
- `api_token` is a literal string OR `{$ENV_VAR}` (resolved at load; missing
  env var is a hard error unless the account is `enabled: false`).
- `base_url` is optional (provider default applies).
- `enabled` defaults to `true`; `false` skips materialization.
- `inject_before` / `inject_after` wrap the rendered output (used to inject
  system-prompt context for agent callers).

### 6.3 `current.json` shape

```json
{ "search": "tavily-main", "fetch": "jina-reader" }
```

Holds the active default account alias per segment, managed by
`web config use <group> <alias>`. An unset segment falls back to the first
declared account. `--account` overrides it per-invocation. This file is the
single "current pointer"; it is separate from `config.json` so config stays
clean/shareable.

### 6.4 Validation

No schema library. The loader hand-validates: top-level keys, segment shapes,
required `provider` on each account, known provider names, `{$ENV}` resolution,
boolean coercion of `enabled`. Errors are concise, flag the offending path, and
exit non-zero.

## 7. Provider Protocol Layer (the core abstraction)

This is the heart of the architecture. It is generic over `<Req, Res>` so each
capability segment instantiates its own strongly-typed pool. The core never
hardcodes "search"/"fetch".

### 7.1 Failure classification — internal exception identifiers

Every provider failure is mapped to a `FailureClass` for **diagnostics**
(logged per attempt and included in the `ALL_FAILED` details):

| `FailureClass` | Meaning |
|---|---|
| `retryable-credential` | auth/quota tied to this key/account (401/403) |
| `retryable-transport` | transient network/5xx (429/5xx, curl transport errors) |
| `non-retryable-request` | 4xx request error (400/404/422/…) |
| `unsupported` | provider cannot serve this request shape |
| `unknown` | unclassified |

**Pool rotation rule (single, simple):** on any failure, advance to the next
configured account; stop only when one succeeds or all have been tried
(`*_ALL_FAILED`). The `FailureClass` is recorded but does **not** gate rotation.
We deliberately do not short-circuit on `non-retryable-request`: HTTP status
codes are an unreliable signal — e.g. Brave returns **422** for an
invalid-token auth error (`SUBSCRIPTION_TOKEN_INVALID`), which is
account-specific and should rotate, not stop. Always rotating is simpler,
correct, and yields a full per-account diagnostic trail.

### 7.2 Provider hooks

A provider registers callback hooks with the coordinator (no inheritance, no
request knowledge beyond the typed `Req`):

```ts
interface ProviderHooks<Req, Res> {
  buildRequest(req: Req, ctx: HookCtx): Promise<TransportRequest> | TransportRequest;
  parseResponse(res: TransportResult, req: Req, ctx: HookCtx): Promise<Res> | Res;
  classifyFailure?(error: unknown, ctx: HookCtx): FailureClass;  // default "unknown"
}
interface ProviderInstance<Req, Res> {
  id: string;            // account alias
  providerName: string;  // factory name, e.g. "tavily"
  hooks: ProviderHooks<Req, Res>;
}
```

### 7.3 Coordinator (`ProviderPool`)

```ts
class ProviderPool<Req, Res> {
  run(req: Req, opts): Promise<ProviderResponse>
  // opts: { forcedAccount?, forcedProvider?, resolver, segment }
}
```

Dispatch algorithm (failover):

1. Resolve ordered candidate instances for the segment from
   `current.json` + config + `opts`.
2. For each instance in order:
   1. `hooks.buildRequest(req)` → `TransportRequest`
   2. `transport.execute(...)` → `TransportResult`
   3. `hooks.parseResponse(...)` → `ProviderResponse`; return on success.
   4. On throw: `hooks.classifyFailure(error)` → `FailureClass`. Log
      `(id, class)`. If `non-retryable-request` → re-throw. Else continue.
3. If none succeeded: throw `AppError("<SEGMENT>_ALL_FAILED")`.

> Multi-provider concurrent merge (`--providers`) is intentionally **not** in
> v1. Failover + `--provider`/`--account` selection covers the use cases.

## 8. Transport Layer

```ts
interface Transport { execute(req: TransportRequest): Promise<TransportResult>; }
interface TransportRequest {
  method: "GET" | "POST" | ...;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;        // mutually exclusive with form
  form?: FormField[];
  timeoutMs?: number;
}
interface TransportResult { statusCode: number; headers: Record<string,string>; bodyText: string; }
```

`CurlTransport` spawns the system `curl`:

- Flags: `-sS` (silent, show errors), `--fail-with-body` (exit 22 on 4xx/5xx,
  still emit body), `--max-time` (from `timeoutMs`), `--location`,
  `--dump-header @tmp`, `--data-binary @tmpjson` or `--form`.
- Auth headers (`authorization`, `x-subscription-token`, `x-api-key`,
  `x-goog-api-key`) are masked before they reach logs.
- Non-2xx raises a transport error carrying the safe status + body excerpt.

`playwright` is the one fetch provider that bypasses `Transport` (it drives a
browser directly); all others go through `curl`.

## 9. Output

`render(response, format, maxLength, injectBefore, injectAfter)`:

- `json` → `{ items, raw? }` pretty JSON
- `markdown` → per-item `## N. title` + URL/snippet/content
- `text` → per-item `[N] title` + url/snippet/content
- Wrap with `injectBefore` / `injectAfter`, then hard-cut at `maxLength`
  (`...[truncated]` suffix).

Secrets and raw provider payloads never appear in default stdout. Diagnostics
go to logs or (for fetch) the temp file.

## 10. Observability

- `runtime.logging` defaults to `true`. `FileLogger` writes
  `[ts] label\n<body>\n\n` entries to `<effective-.web>/logs/<date>-<id>.log`.
- Logged: CLI command + args, http.request (masked auth), http.response
  (status + body), pool attempt `(id, FailureClass)`.
- `web config doctor` is the user-facing diagnostic surface.

## 11. Error Handling

- Validation errors are concise and flag-specific; they print scoped help and
  exit non-zero.
- Provider errors include the provider/account id and a safe status/message
  (never the secret). `non-retryable-request` short-circuits failover.
- Exit codes: `0` success; `1` any handled error; propagated via `process.exitCode`.
- Stack traces are never part of normal CLI output.

## 12. Plugin Protocol

External providers live under `~/.web/plugins/<id>/`:

```json
// ~/.web/plugins/<id>/plugin.json
{ "id": "acme", "main": "index.cjs", "version": "1.0.0", "runtime": "node" }
```

- v1 supports `runtime: "node"` (CommonJS, `require`-d **in-process** — same
  privilege model as built-ins; only install trusted plugins). The plugin's
  default export is a `WebPlugin { activate(api) }` that calls
  `api.registerProvider(name, factory)` with the same factory shape as
  built-ins. Later-loaded plugins override same-named factories (project
  `./.web/plugins` overrides `~/.web/plugins` overrides built-in).
- A subprocess runtime (`node`/`python`/`executable` over JSON stdio) is
  reserved for a future revision; the factory interface already accommodates it.

## 13. Out of Scope (v1)

- `web research` and `web answer` commands (removed).
- Multi-profile config (single `config.json` + `current.json` pointer only).
- `--providers` concurrent multi-provider merge (failover only).
- Kimi/Moonshot provider (no real search API).
- Live model discovery for `web provider <id> models` (built-in list only).
- Implicit/black-box fallback — failover is always classified and logged.
