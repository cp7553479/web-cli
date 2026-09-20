---
name: web-cli
description: Use the `web` CLI for web search and fetching page content via official provider APIs, with multi-account failover.
---

# web CLI

Unified CLI for **web search**, **web fetch** and **image search** over
multi-provider accounts (search: Brave, Tavily, Jina, Firecrawl, Perplexity,
Exa, Serper, self-hosted SearXNG; images: Pixabay, Pexels, Serper; plus
keyless `http` / `html2markdown` / `playwright` fetchers). HTTP goes
through the system `curl`.

## Install from npm

**Package page:** [https://www.npmjs.com/package/@cp7553479/web-cli](https://www.npmjs.com/package/@cp7553479/web-cli)

```bash
npm install -g @cp7553479/web-cli
web --version
```

## search — find web pages by keyword

Returns a list of URLs with titles and snippets.

```bash
web search "query"
web search "query" --site github.com npmjs.com
web search "query" --country US --language en --freshness week
web search "query" --limit 10
web search "query" --account tavily-main      # pin one configured account
```

`--freshness` accepts `day|week|month|year`.

## fetch — get the content of a web page

Extracts the main text/markdown from one or more URLs.

```bash
web fetch https://example.com                                 # no fetch account needed: browser fallback
web fetch https://a.com https://b.com -f markdown
web fetch https://spa.example.com --provider playwright --wait-until networkidle
web fetch https://example.com --selector "article"
```

Output longer than the configured output limit is **not** printed; it is
saved to a file under `.web/temp/` and the file path is reported instead.

## search-image — find images by keyword

Returns image URLs (Pixabay / Pexels / Serper accounts). Configure an account
under the `images` group, then:

```bash
web config add images pixabay-main --provider pixabay --token '{$PIXABAY_KEY}'
web search-image "sunset over mountains"            # markdown embeds ![alt](url)
web search-image "city night" --limit 5 --account pixabay-main
web search-image "logo" --provider serper -f json
```

## ask — ask LLMs with live web search

Routes across LLM vendor accounts; each plugin injects the vendor's own
web-search tool plus a fixed instruction: answer with numbered inline
citations `[N]` and end with a `Sources:` list.

```bash
web config add ask deepseek-main --provider deepseek --token '{$DEEPSEEK_API_KEY}'
web ask "what changed in nodejs 24?" --model deepseek/deepseek-chat
web ask "compare tavily vs exa" --model openrouter/moonshotai/kimi-k2.6
web ask "latest k8s version?" --account zhipu-coding     # pin one account
```

Model ids follow the liteLLM convention (`provider/model`); each vendor also
has a built-in default, and an account may pin one with a `model` field.
Vendors without a web-search tool (DeepSeek, MiniMax) answer without live
citations.

## Global options

Place these between `web` and the subcommand:

```bash
web -f markdown search "query"
web --max-length 20000 fetch https://example.com
```

| Option                  | Default | Purpose             |
| ----------------------- | ------- | ------------------- |
| `-f json\|markdown\|text` | `text`  | Output format       |
| `--max-length N`        | `10000` | Truncate output     |
| `--timeout-ms N`        | `15000` | Per-request timeout |

## Routing options

Available on `search` and `fetch`:

| Option              | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `--account <alias>` | Pin one account from config                      |
| `--provider <name>` | Pin one provider type (or account alias)         |
| `--vendor k=v`      | Provider-native param (repeatable, allowlisted)  |

With neither flag, requests **fail over**: the active account (pointer in
`current.json`) is tried first, then the remaining accounts in declaration
order. Every failure is classified and logged, then the next account is tried;
the command fails only when all accounts have failed, printing a per-account
breakdown (`SEARCH_ALL_FAILED` / `FETCH_ALL_FAILED`).

## Config & accounts

```bash
web config init                                                  # ~/.web/config.json + .env + agent skills
web config add search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
web config add search jina --provider jina --field base_url=https://s.jina.ai
web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
web config use search tavily-main                                # set active account pointer
web config list                                                  # accounts + provider order (tokens masked)
web config doctor                                                # self-check: config/curl/env/order
web provider list                                                # built-in + plugin providers
web provider models perplexity                                   # known models
```

`web config add` is guided by the provider's config schema: in a terminal it
shows menus (e.g. picking one of a provider's base URLs); with `--field
key=value` it runs non-interactively. Only the values you answer are written.

Files: the active config is `./.web/config.json` (project scope, wins when
present) else `~/.web/config.json`; active-account pointers live in the
**separate** `current.json`. Tokens are plaintext or `{$ENV_VAR}` references
resolved from the process environment, then `~/.web/.env`, then `./.web/.env`.

Logs: `~/.web/logs/*.log` (or `./.web/logs/` when a project config exists).
Raw requests/responses go to logs, never stdout.

## Troubleshooting

See `troubleshooting.md` in the same directory. More examples in `examples.md`.
