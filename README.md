# web-cli

Reliable web search and page fetching for your terminal and your AI agents — one
config file, many providers, and automatic failover when any of them misbehaves.

## Why web-cli

Anyone who wires agents or scripts to the web hits the same wall sooner or
later: a single search API works fine until it rate-limits you, a key expires,
or a quota runs out — and everything downstream breaks with it. Even on a good
day, the raw JSON most APIs return needs reshaping before an agent can do
anything useful with it.

web-cli turns the providers you already have accounts with — Tavily, Brave,
Jina, Firecrawl, Perplexity, Exa, Serper, or your own self-hosted SearXNG —
into one command. Describe your accounts once in
a plain config file, and from then on `web search` and `web fetch` just work,
and keep working: when an account fails, the next one takes over
automatically; the failed one cools down for fifteen minutes and recovers on
its own. Everything talks to official APIs over plain HTTP — no vendor SDKs,
nothing scraped.

The output is shaped for the consumer instead of the API: clean Markdown by
default (JSON and plain text too), bounded so it never floods a terminal or a
context window, with oversized results saved to a file and the path printed.

## Highlights

- **Failover that actually works** — key pools per provider, a priority order
  you control, 15-minute cooldowns that survive restarts, and a guaranteed
  stop after every account has been tried once
- **Image search too** — `web search-image` over Pixabay, Pexels and Serper
  with the same config, failover and priority model
- **Ask LLMs with live web access** — `web ask` routes across 12 vendors
  (ChatGPT, Gemini, Claude, Grok, Kimi, DeepSeek, Doubao, Qwen, MiniMax,
  OpenRouter, GLM, …); each plugin injects the vendor's own web-search tool
  and returns answers with numbered citations and a source list
- **Agent-friendly output** — Markdown by default, `--format json|markdown|text`,
  always bounded, never dumps unbounded content into your context
- **One config file** — accounts, keys with `{$ENV_VAR}` references, provider
  priority, per-provider on/off switches
- **Bring your own provider** — one small plugin contract for anything not
  built in, including providers that offer several base URLs
- **Official APIs only** — plain HTTP via the system `curl`, nothing scraped

## Install

```bash
npm install -g @cp7553479/web-cli
web --version
```

## Quick start

```bash
web config init                                       # writes ~/.web/config.json + .env + agent skills
web config add search tavily-main --provider tavily --token 'tvly-...'
web config add search tavily-backup --provider tavily --token 'tvly-backup-key'

web search "nodejs cli framework" --site github.com --limit 8
web search "AI news" -f markdown
web fetch https://example.com
web search-image "sunset over mountains" --limit 10   # image search (pixabay / pexels / serper)
web ask "what changed in nodejs 24?" --model gemini/gemini-flash-latest
web doctor --fix                                     # self-check + auto-repair
web update --check                                   # check for a newer version
web provider list                                    # show built-in + plugin providers
```

`web config add` walks you through each provider's options (endpoint, key);
in scripts, add `--field key=value` to answer prompts non-interactively.

## Commands

| Command | Purpose |
|---|---|
| `web search <query>` | Web search via configured accounts (official APIs) |
| `web fetch <urls...>` | Fetch page content (curl / API / browser; automatic browser fallback when others fail) |
| `web search-image <query>` | Image search via configured accounts (pixabay / pexels / serper) |
| `web ask <question>` | Ask LLMs with their native web-search tool; citations included |
| `web config {init\|add\|path\|show\|list\|set\|remove\|use}` | Manage `~/.web/config.json` + `current.json` |
| `web doctor [--json] [--fix]` | Self-check config / curl / accounts; `--fix` auto-repairs |
| `web update [--check]` | Update the CLI to the latest published version |
| `web provider {list\|models}` | Inspect providers |

Global flags: `-f, --format json|markdown|text`, `--max-length <n>` (default
50000 — larger output is saved to a file and the path printed),
`--timeout-ms <n>` (default 30000). Search/fetch accept `--provider
<aliasOrName>` and `--account <alias>` to pin an account; otherwise the
segment's provider priority order applies with automatic failover.

## Configuration

The active config is `./.web/config.json` when present (a project scope,
self-contained), else `~/.web/config.json`. Tokens are plaintext or
`{$ENV_VAR}` references resolved from the environment and `.env` files.

```json
{
  "runtime": { "lock_ttl_ms": 900000, "retry_rounds": 1 },
  "providers": { "tavily": { "enabled": false } },
  "search": {
    "providers": { "primary": "tavily", "list": ["brave", "perplexity"] },
    "account": {
      "tavily-main": { "provider": "tavily", "api_token": "{$TAVILY_API_KEY}" },
      "tavily-backup": { "provider": "tavily", "api_token": "tvly-…" }
    }
  },
  "fetch": { "account": {} }
}
```

- `providers.<name>.enabled: false` turns a provider off everywhere; `web
  provider list` and `web doctor` show the state.
- `search.providers` / `fetch.providers` set the fallback order: `primary`
  first, then `list`, then the rest.
- `runtime.lock_ttl_ms` (default 900000) is how long a failed account stays
  out; `runtime.retry_rounds` (default 1) is how many passes over all
  accounts before giving up.
- `web config use <group> <alias>` writes the active default account to the
  separate `current.json`.

## How failover works

On any provider failure, `web` records what went wrong, **locks the account
for 15 minutes** (persisted to `<active-.web>/locks.json`, so cooldowns
survive across invocations), and advances to the next account. Locked
accounts are skipped; when every account is locked they are retried
earliest-locked-first. The queue is walked once per invocation by default, so
the loop always terminates; when nothing succeeds you get `*_ALL_FAILED` with
a per-account breakdown. Pinned `--provider`/`--account` runs bypass the lock
file.

Each attempt is logged to `~/.web/logs` (or `./.web/logs`). See
[`docs/error-handling.md`](./docs/error-handling.md).

## Plugins

Every provider is a plugin with one contract: `activate(host)` calls
`host.registerFactory(name, factory)`. A factory may declare a `config`
schema (e.g. multiple base URLs) that `web config add` turns into menus;
picked values are written flat into the account entry. Built-ins ship in
`src/web/plugins/builtin/`; external providers live under
`~/.web/plugins/<id>/plugin.json` as CommonJS modules. See
[`docs/plugin-protocol.md`](./docs/plugin-protocol.md).

## Documentation

- [`SPEC.md`](./SPEC.md) — the authoritative, complete specification
- [`docs/plugin-protocol.md`](./docs/plugin-protocol.md) — write your own provider plugin
- [`docs/provider-apis.md`](./docs/provider-apis.md) — verified provider endpoints
- [`docs/error-handling.md`](./docs/error-handling.md) — failure classes, logs, self-check

## License

MIT
