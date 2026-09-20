# web-cli SPEC

> Status: authoritative requirements document. Any change to commands, flags,
> config shape, provider behavior, or the core boundary MUST update this file
> first. Implementation follows this spec, not the reverse.

## 1. Goal

One local CLI, `web`, that turns web **search**, web **fetch**, and web
**image search** into reusable,
agent-friendly infrastructure, built on a portable abstraction layer
(`src/core/`).

Public commands:

- `web search <query>`
- `web fetch <url...>`
- `web search-image <query>`
- `web ask <question> [--model provider/model]`
- `web config <subcommand>`
- `web provider <subcommand>`
- `web doctor [--fix]`
- `web update`

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
   imports from `src/web/**`.
5. **Minimal dependencies.** Prefer Node built-ins + `curl` over libraries.
   Libraries are admitted only when a built-in cannot do the job
   (`commander` = CLI, `linkedom` = DOM for html2markdown, `playwright` =
   browser fetch).
6. **Agent-friendly output.** Default output is bounded and structured.
   Secrets, raw requests, and raw responses never reach default stdout.
7. **Config is data.** The active configuration is `./.web/config.json` when
   present, else `~/.web/config.json` (auto-initialized on first run). Keys
   may be inline or `{$ENV}` references.

## 3. CLI Grammar

```
web --help
web --version
web <command> [options]

web search <query> [options]
web fetch <url...> [options]
web search-image <query> [options]
web ask <question> [--model provider/model] [options]

web config init [--force]
web config add <group> <alias> --provider <p> [--token <t>] [--field <k=v>]...
web config path
web config show [--json]
web config list
web config set <group> <alias> --provider <p> [--token <t>] [--base-url <u>] [--enabled <bool>]
web remove <group> <alias>            (alias: web config remove-model)
web config use <group> <alias>

web provider list [--json]
web provider <provider-id> models [--json]

web doctor [--json] [--fix]
web update [--check]
```

### 3.1 Global flags (apply to `search`, `fetch`, `search-image` and `ask`)

| Flag | Values | Default | Notes |
|---|---|---|---|
| `-f, --format` | `json` \| `markdown` \| `text` | `markdown` | output format |
| `--max-length <n>` | positive int | `50000` | when rendered output is longer, the COMPLETE record is written to a file (`./.web/temp/` when the project has a `.web` directory, else `~/.web/temp/`) and stdout prints the file path |
| `--timeout-ms <n>` | positive int | `30000` | per-request timeout (curl `--max-time`) |

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

- Without `--provider`/`--account`, accounts under `[search]` are tried in the
  segment's provider fallback order (`providers.primary` → `providers.list` →
  the rest), with account-level failover inside each provider group and
  cooldown-based queueing (see §7.3). The active default account from
  `current.json` (see §7) is tried first when set.
- `--provider <name>` resolves to either an account alias or all accounts of a
  provider type, in fallback order.
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
- **Playwright fallback:** when no fetch accounts are configured, or every
  configured fetch account fails (timeout, quota, auth, …), the page is
  fetched through the playwright plugin (headless by default; an account may
  set `headless: "false"` via its config schema) and the rendered page is
  cleaned to readable Markdown. Pinning a non-playwright provider/account
  disables the fallback — the error propagates. Oversized-output spill
  (`--max-length`, see §3.1) applies to `fetch` and `search` alike.

### 3.4 `web search-image`

```
web search-image <query>
  [--limit <n>]                   # result count (default 10)
  [--provider <aliasOrName>]      # pin one account alias or provider type
  [--account <alias>]             # pin one account id
  [--vendor <key=value>...]       # provider-native params (allowlist-filtered)
```

- Runs over the `[images]` segment: same failover/locks/provider-order
  semantics as `search` (`images.providers.primary` / `list`, accounts per
  provider).
- Output: Markdown embeds `![alt](image-url)` (json/text also available);
  oversized output spills per §3.1.

### 3.5 `web ask`

```
web ask <question>
  [--model provider/model]        # liteLLM-style id; provider part routes the pool
  [--provider <aliasOrName>]      # pin one account alias or provider type
  [--account <alias>]             # pin one account id
  [--vendor <key=value>...]       # merged into the request body (provider-native)
```

- Runs over the `[ask]` segment: same failover/locks/provider-order semantics
  as the other segments.
- Each vendor plugin injects its own web-search tool (`web_search`,
  `google_search`, `$web_search`, search plugins, …) plus a fixed English
  instruction: answer from live web search, cite sources inline as `[N]`, and
  end with a `Sources:` list in the form `[N] <title> - <URL>`.
- Default model per account is the account's `model` field; the plugin also
  carries a vendor default. `--model provider/model` overrides both and
  routes to that provider's accounts.
- Vendors without a web-search tool (DeepSeek, MiniMax) still answer, without
  live citations. XAI deprecated server-side live search (410); grok answers
  without it today.

### 3.6 `web config`

- `init` — non-interactively write the default `config.json` and `.env` into
  `~/.web` and install the bundled agent skills (see §6.1 load rule 3).
  `--force` overwrites an existing `config.json` and installed skill files.
- `add <group> <alias> --provider <p>` — add an account guided by the
  provider's config schema (§12): in a TTY, `options` render numbered menus
  (nested levels open on pick) and other fields prompt free-text; in
  scripts/agents `--field <k=value>` pre-answers prompts. Answered values are
  written flat onto the account entry; unanswered fields are omitted.
- `path` — print resolved config / current / logs paths.
- `show [--json]` — sanitized resolved config (keys masked). `--json` emits raw
  JSON.
- `list` — list configured accounts per group with masked keys (human text).
- `set <group> <alias> --provider <p> ...` — upsert an account entry.
- `remove <group> <alias>` — delete an account entry.
- `use <group> <alias>` — write the active default account for a group into
  `current.json` (see §7).

### 3.7 `web doctor`

- Self-check: config exists & parses, every account's provider has a
  registered factory, curl is on PATH, `{$ENV}` references resolve against the
  layered env.
- `--fix` repairs what is safe: create missing `config.json` / `.env`
  (defaults), reset a corrupt `current.json` to `{}`. Everything else is
  report-only.
- Exit code: non-zero when config fails to load, curl is missing, or an
  account references an unknown provider; unresolved `{$ENV}` is a warning
  (exit 0).
- `--json` emits the raw report (including the `fixed` list).

### 3.8 `web update`

- Resolves the latest published version via `npm view @cp7553479/web-cli
  version`; if newer than the running version, runs
  `npm install -g @cp7553479/web-cli@latest`.
- `--check` only reports (`update available: <cur> -> <new>`) without
  installing.
- npm missing, registry unreachable, or install failure → concise error,
  non-zero exit.

### 3.9 `web provider`

- `list [--json]` — list built-in + plugin provider ids, aliases, default base
  URL, declared capabilities; shows `enabled=false` for providers turned off
  via `providers.<name>.enabled`.
- `<provider-id> models [--json]` — list known models for a provider (built-in
  list; no live discovery).

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

interface ImageSearchRequest {
  query: string;
  limit: number;
  vendorParams?: Record<string, unknown>;
}

interface AskRequest {
  question: string;
  model?: string;
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

Three orthogonal capability segments: **`search`**, **`fetch`** and
**`images`**. Each account is declared under exactly one segment. A provider
factory may implement any of them; an account is only materialized for a
segment if its provider factory implements that segment.

Provider × capability matrix:

| Provider   | search | fetch | images | Notes |
|------------|:------:|:-----:|:------:|-------|
| brave      |   ✓    |       |        | `X-Subscription-Token` |
| tavily     |   ✓    |   ✓   |        | search `/search` + extract `/extract` |
| jina       |   ✓    |   ✓   |        | `s.jina.ai` (search) + `r.jina.ai` (reader) |
| firecrawl  |   ✓    |   ✓   |        | **v2** `/v2/search` + `/v2/scrape` |
| perplexity |   ✓    |       |        | `/v1/sonar`; returns grounded answer + `search_results[]` |
| exa        |   ✓    |       |        | `POST /search`, `x-api-key`; `includeDomains`/`startPublishedDate` |
| serper     |   ✓    |       |   ✓    | `X-API-KEY`; web `POST /search` + images `POST /images` |
| zhipu      |   ✓    |       |        | GLM ask + standalone `POST /web_search` (`search_result[]`) |
| volcengine |   ✓    |       |        | Doubao chat + `web_search` tool (citations extracted) |
| minimax    |   ✓    |       |        | M2 chat + `web_search_20250305` tool (citations extracted) |
| searxng    |   ✓    |       |        | self-hosted; `GET {base_url}/search?format=json` (base_url required) |
| pixabay    |        |       |   ✓    | `GET /api/?key=…` (free key); `hits[]` → `largeImageURL`/`tags` |
| pexels     |        |       |   ✓    | `GET /v1/search`, `Authorization` (free key); `photos[]` → `src`/`alt` |
| http       |        |   ✓   |        | raw curl GET, returns body |
| html2markdown |     |   ✓   |        | curl GET → Readability → turndown |
| playwright |        |   ✓   |        | browser-driven; the only way to render SPAs; default fetch fallback (headless configurable) |

Ask (LLM) vendors — all `ask`-capable; each injects its own web-search tool
plus the fixed citation instruction. Plans (agent-plan / coding-plan /
token-plan) are the same vendor reached through a different account
`base_url` + `model`:

| Vendor     | Protocol         | Default base | Default model | Web tool |
|------------|------------------|--------------|---------------|----------|
| chatgpt    | OpenAI Responses | api.openai.com/v1 | gpt-5-mini | web_search |
| gemini     | Gemini | generativelanguage.googleapis.com/v1beta | gemini-flash-latest | google_search |
| claude     | Anthropic | api.anthropic.com | claude-haiku-4-5 | web_search_20250305 |
| grok       | OpenAI Chat | api.x.ai/v1 | grok-4-fast | — (xAI deprecated live search) |
| deepseek   | OpenAI Chat | api.deepseek.com | deepseek-chat | — |
| kimi       | OpenAI Chat | api.moonshot.cn/v1 | kimi-k3 | builtin_function $web_search |
| volcengine | OpenAI Chat | ark.cn-beijing.volces.com/api/v3 (plan: /api/plan/v3) | doubao-seed-1-6-flash-250615 | web_search |
| bailian    | OpenAI Chat | dashscope compatible-mode (plan base_url variants) | qwen-flash | enable_search |
| minimax    | OpenAI Chat | api.minimax.chat/v1 | MiniMax-M2 | — |
| openrouter | OpenAI Chat | openrouter.ai/api/v1 | moonshotai/kimi-k2.6 | web plugin |
| zai        | OpenAI Chat | api.z.ai/api/paas/v4 (coding: /api/coding/paas/v4) | glm-4.5-flash | web_search |
| zhipu      | OpenAI Chat | open.bigmodel.cn/api/paas/v4 | glm-4.6 | web_search |

Model ids follow the liteLLM naming convention; `--model provider/model`
routes on the provider part and passes the rest to the request.

Not supported (and why):

- **Moonshot/Kimi** — no standalone search API; only grounded chat with
  encrypted payloads. Not a `{title,url,snippet}` source. Revisit if a real
  search endpoint ships.
- **Bing Web Search** (retired by Microsoft, Aug 2025), **DuckDuckGo** (no
  official API), **Kagi** (paid consumer subscription required).

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
./.web/config.json        project scope (wins over global when present)
./.web/current.json       project active-account pointer
./.web/logs/              project logs (used when ./.web exists)
./.web/temp/              large-fetch output spillover
```

Load rules (fallback order):

1. If `./.web/config.json` exists, the project scope is active and its config
   is used exclusively (a project is self-contained: its own `config.json`,
   `current.json`, `.env`, `logs/`, `plugins/`).
2. Otherwise the global `~/.web/config.json` applies.
3. If no directory exists at all, any command auto-initializes `~/.web`:
   default `config.json` + `.env` + agent skills installed to
   `~/.web/skills/web-cli`, `~/.agents/skills/web-cli`, and the `skills/`
   dir of every profile under `~/.hermes/profiles/<profile>/` (existing files
   are never overwritten; `web config init --force` refreshes them). A
   one-line notice goes to stderr on first-run init.
4. Resolve `{$ENV}` tokens in the active config against `process.env` →
   `~/.web/.env` → `./.web/.env` (later sources win).

### 6.2 `config.json` shape

```json
{
  "runtime": { "logging": true, "lock_ttl_ms": 900000, "retry_rounds": 1 },
  "providers": {
    "tavily": { "enabled": false }
  },
  "search": {
    "providers": {
      "primary": "tavily",
      "list": ["brave", "perplexity"]
    },
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
  },
  "images": {
    "account": {
      "pixabay-main": { "provider": "pixabay", "api_token": "{$PIXABAY_KEY}" }
    }
  }
}
```

- `[images]` and `[ask]` mirror the `[search]`/`[fetch]` shape (optional
  segments; older configs without them keep working) and back
  `web search-image` / `web ask`.

- `provider` MUST match a factory registered by a plugin (all providers,
  including built-ins, are plugins — see §12).
- `api_token` is a literal string OR `{$ENV_VAR}` (resolved at load; missing
  env var is a hard error unless the account is `enabled: false`).
- `base_url` is optional (provider default applies).
- Beyond the keys above, accounts may carry provider schema fields (flat
  strings, e.g. `"model"`); validation passes them through and materialize
  hands them to the factory via `binding.fields`.
- `enabled` defaults to `true`; `false` skips materialization.
- `providers.<name>.enabled: false` disables a provider EVERYWHERE: its
  accounts are skipped at materialize (`provider-disabled`), and
  `web provider list` / `web doctor` surface the state (warning, not failure).
- `[search].providers` / `[fetch].providers` set the per-segment fallback
  order: `primary` is the default provider (tried first), `list` orders the
  remaining fallback providers; unlisted providers follow in first-appearance
  order. Accounts are grouped by this order (declared order within a group).
- `runtime.lock_ttl_ms` — cooldown for an account after a failure.
  Default `900000` (15 minutes). The cooldown is persisted to
  `<active-.web>/locks.json` and survives across invocations.
- `runtime.retry_rounds` — how many full passes over the account queue before
  `*_ALL_FAILED`. Default `1`: each account is tried at most once per
  invocation. Values > 1 re-walk the queue (locked accounts last,
  earliest-locked first). These two are config-only — there are no CLI flags
  for them.
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
  // opts: { forcedAccount?, forcedProvider?, segment }
}
```

Candidate queueing (automatic runs, no `--provider`/`--account`):

1. Accounts are grouped by provider in the segment's fallback order:
   `providers.primary` first, then `providers.list`, then the remaining
   providers in first-appearance order; declared order within each provider.
2. The preferred account from `current.json` (see §6.3) moves to the front.
3. Accounts in cooldown (see below) are moved to the back of the queue,
   ordered by earliest lock expiry — they are retried only after every
   unlocked account has failed.

Dispatch algorithm (failover):

1. Walk the queue top to bottom. Per instance:
   1. `hooks.buildRequest(req)` → `TransportRequest`
   2. `transport.execute(...)` → `TransportResult`
   3. `hooks.parseResponse(...)` → `ProviderResponse`; on success the
      account's lock (if any) is cleared and the result is returned.
   2. On throw: `hooks.classifyFailure(error)` → `FailureClass`, logged
      `(id, class)`; the account is **locked** (cooldown persisted to
      `<active-.web>/locks.json`, default 15 min, `runtime.lock_ttl_ms`)
      and the walk continues. Rotation is unconditional — the class is
      diagnostic, it does not gate rotation.
2. The walk is repeated `runtime.retry_rounds` times (default 1 — every
   account is tried at most once per invocation, so the loop always
   terminates). Between rounds the lock file is re-read and the queue is
   re-ordered locked-last / earliest-locked-first.
3. If nothing succeeded after all rounds: `AppError("<SEGMENT>_ALL_FAILED")`
   with the per-account attempt trail.

`--provider` / `--account` pin a run: the lock file is neither read nor
written, and the candidate list is exactly the pinned selection.

> Multi-provider concurrent merge (`--providers`) is intentionally **not**
> supported. Failover + `--provider`/`--account` selection covers the use cases.

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

`render(response, format, injectBefore, injectAfter)` produces the full output:

- `json` → `{ items, raw? }` pretty JSON
- `markdown` → per-item `## N. title` + URL/snippet/content
- `text` → per-item `[N] title` + url/snippet/content
- Wrapped with `injectBefore` / `injectAfter`; `emitResult` then either prints
  it or spills the complete record to a file when it exceeds `--max-length`
  (see §3.1).

Secrets and raw provider payloads never appear in default stdout. Diagnostics
go to logs or (for fetch) the temp file.

## 10. Observability

- `runtime.logging` defaults to `true`. `FileLogger` writes
  `[ts] label\n<body>\n\n` entries to `<effective-.web>/logs/<date>-<id>.log`.
- Logged: CLI command + args, http.request (masked auth), http.response
  (status + body), pool attempt `(id, FailureClass)`.
- `web doctor` is the user-facing diagnostic surface.

## 11. Error Handling

- Validation errors are concise and flag-specific; they print scoped help and
  exit non-zero.
- Provider errors include the provider/account id and a safe status/message
  (never the secret). `non-retryable-request` short-circuits failover.
- Exit codes: `0` success; `1` any handled error; propagated via `process.exitCode`.
- Stack traces are never part of normal CLI output.

## 12. Plugin Protocol

ALL providers are plugins with one contract. Built-ins ship inside the package
as `WebPlugin` modules (`src/web/plugins/builtin/<name>.ts`, each exporting
`activate(host)`); external providers live under `~/.web/plugins/<id>/` with a
`plugin.json` manifest:

```json
// ~/.web/plugins/<id>/plugin.json
{ "id": "acme", "main": "index.cjs", "version": "1.0.0" }
```

- `loadPlugins()` (`src/web/plugins/index.ts`) is the single entry point:
  built-in plugins activate first, then user plugins, then project plugins —
  later registrations override same-named factories. There is no separate
  "built-in registry"; the CLI reaches providers ONLY via the `PluginHost`.
- Both kinds call `host.registerFactory(name, factory)` with the same factory
  shape. A factory may declare `config: ProviderConfigField[]` — the provider
  config schema that drives `web config add` menus; written values are flat
  account fields handed back via `binding.fields` (see docs/plugin-protocol.md).
  Only external `runtime: "node"` is supported (CommonJS, `require`-d
  **in-process** — same privilege model as built-ins; only install trusted
  plugins).
- A subprocess runtime (`node`/`python`/`executable` over JSON stdio) is
  reserved for the future; the factory interface already accommodates it.
- Disabling: `providers.<name>.enabled: false` in config skips the provider's
  accounts at materialize; the factory stays registered so
  `web provider list` can show the state.

## 13. Out of Scope

- `web research` and `web answer` commands.
- Multi-profile config (single `config.json` + `current.json` pointer only).
- `--providers` concurrent multi-provider merge (failover only).
- Kimi/Moonshot provider (no real search API).
- Live model discovery for `web provider <id> models` (built-in list only).
- Implicit/black-box fallback — failover is always classified and logged.
