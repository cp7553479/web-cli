---
name: web-cli
description: Use the `web` CLI for web search, fetch page content, deep research via vendor APIs, and quick Q&A.
---

# web CLI

Unified CLI that talks to multiple vendor APIs (Jina, Tavily, Brave, Perplexity, DuckDuckGo, Firecrawl, Playwright, etc.) for web operations.

## Install from npm

**Package page:** [https://www.npmjs.com/package/@cp7553479/web-cli](https://www.npmjs.com/package/@cp7553479/web-cli)

```bash
npm install -g @cp7553479/web-cli
```

## search — find web pages by keyword

Returns a list of URLs with titles and snippets.

```bash
web search "query"
web search "query" --site github.com npmjs.com
web search "query" --country US --language en --freshness week
web search "query" --limit 10
web search "query" --providers jina-main tavily-main    # concurrent multi-source
```

## fetch — get the content of a web page

Extracts the main text/markdown from one or more URLs.

```bash
web fetch https://example.com
web fetch https://a.com https://b.com -f markdown
web fetch https://spa.example.com --provider playwright --wait-until networkidle
web fetch https://example.com --selector "article"
```

## research — deep research via vendor API

Calls the vendor's dedicated research endpoint (e.g. Tavily, Perplexity). This is **not** a local search-then-fetch pipeline.

```bash
web research "topic" --max-sources 6
web research "topic" --providers tavily-main perplexity-main
```

## answer — quick Q&A

Gets a direct answer from a Q&A vendor API (DuckDuckGo, Brave, Firecrawl, etc.).

```bash
web answer "question"
web answer "question about this page" --url https://example.com
web answer "question" --providers ddg-main brave-answer
```

## Global options

Place these between `web` and the subcommand:

```bash
web -f markdown search "query"
web --max-length 20000 fetch https://example.com
web --timeout-ms 30000 research "topic"
```


| Option                  | Default | Purpose         |
| ----------------------- | ------- | --------------- |
| `-f json|markdown|text` | `text`  | Output format   |
| `--max-length N`        | `10000` | Truncate output |
| `--timeout-ms N`        | `15000` | Request timeout |


## Routing options

Available on all four commands:


| Option                | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `--account <id>`      | Use a specific account from config       |
| `--provider <vendor>` | Use a specific vendor                    |
| `--providers a b c`   | Concurrent multi-source (results merged) |
| `--vendor k=v`        | Pass vendor-specific parameters          |


If none specified, accounts are tried in the order declared in `config.toml`.

## Config & logs

```bash
web config list                         # show active config
```

Logs: `<cwd>/.web/logs/*.log`

## Troubleshooting

See `troubleshooting.md` in the same directory. More examples in `examples.md`.