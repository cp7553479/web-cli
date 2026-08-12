---
name: web-cli
description: Use the `web` CLI for web search and fetching page content via official provider APIs, with multi-account failover.
---

# web CLI

Unified CLI for **web search** and **page fetch** over multi-provider accounts
(Brave, Tavily, Jina, Firecrawl, Perplexity, plus keyless `http` /
`html2markdown` / `playwright` fetchers). HTTP goes through the system `curl`.

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
web fetch https://example.com
web fetch https://a.com https://b.com -f markdown
web fetch https://spa.example.com --account pw --wait-until networkidle   # playwright account
web fetch https://example.com --selector "article"
```

Fetch output longer than 100k chars is **not** printed; it is saved to
`.web/temp/<timestamp>.md` and the file path is reported instead.

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
web config init                                                  # ~/.web/config.json + .env
web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
web config use search tavily-main                                # set active account pointer
web config list                                                  # accounts (tokens masked)
web config doctor                                                # self-check: config/curl/env
web provider list                                                # built-in + plugin providers
web provider models perplexity                                   # known models
```

Files: `~/.web/config.json` (global) + `./.web/config.json` (project overlay,
deep-merged); active-account pointers live in the **separate** `current.json`.
Tokens are plaintext or `{$ENV_VAR}` references resolved from the process
environment, then `~/.web/.env`, then `./.web/.env`.

Logs: `~/.web/logs/*.log` (or `./.web/logs/` when a project config exists).
Raw requests/responses go to logs, never stdout.

## Troubleshooting

See `troubleshooting.md` in the same directory. More examples in `examples.md`.
