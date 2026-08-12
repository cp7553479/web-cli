# web-cli

A unified **web search** + **web fetch** CLI built on a portable provider-pool
core. One config, many providers (Tavily, Brave, Jina, Firecrawl, Perplexity, …),
HTTP via the system `curl`.

> **v2 is a breaking rewrite.** Config is now JSON (`~/.web/config.json`); the
> `research` and `answer` commands and the Kimi provider were removed; HTTP goes
> through `curl`. The authoritative spec is [`SPEC.md`](./SPEC.md).

## Install

```bash
npm install -g @cp7553479/web-cli
web --version
```

`curl` must be on your PATH (it ships with macOS and most Linux distros).
Optional: `npm install -g playwright` for JS-rendered page fetch.

## Quick start

```bash
web config init                                       # writes ~/.web/config.json + .env
web config set search tavily-main --provider tavily --token 'tvly-...'
web config set fetch jina-reader --provider jina --token 'jina_...'

web search "nodejs cli framework" --site github.com --limit 8
web search "AI news" --provider tavily-main -f markdown
web fetch https://example.com -f markdown
web config doctor                                     # self-check
web provider list                                     # show built-in + plugin providers
```

Keys may be plaintext or `{$ENV_VAR}` references (resolved from `~/.web/.env`,
`./.web/.env`, or the process environment).

## Commands

| Command | Purpose |
|---|---|
| `web search <query>` | Web search via configured accounts (official APIs) |
| `web fetch <urls...>` | Fetch page content (curl / API / browser) |
| `web config {init\|path\|show\|list\|set\|remove\|use\|doctor}` | Manage `~/.web/config.json` + `current.json` |
| `web provider {list\|models}` | Inspect providers |

Global flags: `-f, --format json|markdown|text`, `--max-length <n>`,
`--timeout-ms <n>`. Search/fetch accept `--provider <aliasOrName>` and
`--account <alias>` to pin an account; otherwise accounts are tried in declared
order with classified failover.

## How failover works

On any provider failure, `web` records a `FailureClass`
(`retryable-credential` / `retryable-transport` / `non-retryable-request` /
`unsupported` / `unknown`) for diagnostics and **advances to the next
configured account**. It stops only when one succeeds or all have been tried
(`*_ALL_FAILED`, with the per-account breakdown). Rotation is unconditional —
HTTP status alone is an unreliable signal (e.g. Brave returns 422 for an
invalid-token auth error, which is account-specific and must rotate).

Each attempt is logged to `~/.web/logs` (or `./.web/logs`). See
[`docs/error-handling.md`](./docs/error-handling.md).

## Architecture

```
src/core/    portable abstraction layer (zero upward deps; copy to reuse in other CLIs)
  protocol/  FailureClass, ProviderHooks, ProviderPool, PluginHost
  transport/ Transport interface + CurlTransport
  config/    appName-parameterized loader + {$ENV} resolver
  cli/ output/ logger/ errors.ts
src/web/     web domain (depends on core)
  cli/commands/  search, fetch, config, provider
  protocol/      SearchRequest/FetchRequest/ResultItem + validation
  providers/     brave, tavily, jina, firecrawl, perplexity, http, html2markdown, playwright
  config/        JSON schema, defaults, materialize → per-capability pools
```

The core is generic over `<Req, Res>` and never names "search"/"fetch"; the web
layer instantiates two typed pools. See [`docs/architecture.md`](./docs/architecture.md)
and [`AGENTS.md`](./AGENTS.md) for the boundary rules.

## Config

`~/.web/config.json` (global) + optional `./.web/config.json` (project overlay):

```json
{
  "runtime": { "logging": true },
  "search": { "account": {
    "tavily-main": { "provider": "tavily", "api_token": "{$TAVILY_API_KEY}" }
  } },
  "fetch": { "account": {
    "jina-reader": { "provider": "jina", "api_token": "jina_..." }
  } }
}
```

`web config use <group> <alias>` writes the active default account to the
separate `current.json`.

## Plugins

External providers live under `~/.web/plugins/<id>/plugin.json` as CommonJS
modules that call `api.registerProvider(name, factory)` in `activate`. See
[`docs/plugin-protocol.md`](./docs/plugin-protocol.md).

## Development

```bash
npm run build         # tsc → dist/
npm test              # build + vitest (unit + integration)
npm run test:unit     # core pool/config/classification/vendor-params
```

Live network smoke tests are gated by `WEB_RUN_FETCH_HTTP_SMOKE=1`.

## License

MIT
