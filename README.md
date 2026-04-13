[中文文档](README_CN.md)

# Web CLI User Guide

One command for **search**, **fetch**, **research**, and **answer**.

Configure `~/.web` once, then run `web search …`, `web fetch …`, `web answer …`, or `web research …` from any directory. The `web` CLI talks to each vendor’s **official HTTP APIs** only (no local “search then fetch stitched into research” orchestration).

---

## Table of contents

- [Why this tool](#why-this-tool)
- [What it does](#what-it-does)
- [Install](#install)
- [First-time setup](#first-time-setup)
- [Configuration](#configuration)
- [Global CLI options](#global-cli-options)
- [Commands](#commands)
  - `[web search](#web-search--web-search)`
  - `[web fetch](#web-fetch--web-fetch)`
  - `[web research](#web-research--web-research)`
  - `[web answer](#web-answer--web-answer)`
  - `[web config](#web-config--web-config)`
  - `[web onboard](#web-onboard--web-onboard)`
  - `[web plugins](#web-plugins--web-plugins)`
- [Multi-provider concurrency](#multi-provider-concurrency)
- [Output formats](#output-formats)
- [Logging](#logging)
- [Inject prompt](#inject-prompt)
- [Troubleshooting](#troubleshooting)
- [Built-in providers](#built-in-providers)
- [More documentation](#more-documentation)

---

## Why this tool

AI agents often rely on Tavily, Brave, Jina, and similar services for “search” and “fetch”.

Problems:

- **Each tool wires its own vendor** — you configure Tavily in tool A, then again in tool B.
- **When an API is down or quota is gone**, there is no fallback; the call just fails.

This CLI addresses that by:

1. **Configure once, reuse everywhere.** Put API keys under `~/.web/` and share them across tools.
2. **Multiple vendors per capability.** For example, configure both Jina and Tavily for search; if the first fails, the next is tried automatically.
3. **Secrets stay out of TOML.** Use placeholders like `{$TAVILY_API_KEY}` in `config.toml` and real values in a separate `.env` file.

---

## What it does


| Goal                         | Command                              | One-line summary                                                                         |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Web search                   | `web search "query"`                 | Search-style results: title, URL, snippet.                                               |
| Page content                 | `web fetch https://…`                | One or more URLs; body / extracted content returned.                                     |
| Deep research (official API) | `web research "question"`            | Vendor **research** endpoints (e.g. Tavily `/research`, Perplexity Sonar deep research). |
| Direct answers               | `web answer "question"`              | DuckDuckGo / Brave / Gemini / etc. instant-answer style APIs.                            |
| Multi-source search          | `web search "query" --providers a b` | Concurrent requests; merged results.                                                     |
| View / edit config           | `web config …`                       | List config, add or remove accounts, change order.                                       |
| First-time bootstrap         | `web onboard …`                      | Create `~/.web/` and template files.                                                     |
| List plugins                 | `web plugins list`                   | External plugins only.                                                                   |


**Automatic failover:** search, fetch, answer, and research all try accounts **in order**. The next account runs if the previous errors or times out; you only see an error if all fail. Intermediate failures are not printed to the terminal; they go to the log file.

### The four capabilities (mapped to vendor APIs)


| Capability   | Meaning                                       | CLI            |
| ------------ | --------------------------------------------- | -------------- |
| **search**   | Internet search, LLM-oriented hits            | `web search`   |
| **fetch**    | Page body / extraction, LLM-oriented          | `web fetch`    |
| **answer**   | Vendor-side answer after retrieval / browsing | `web answer`   |
| **research** | Deeper “research” class APIs from vendors     | `web research` |


Each subcommand **only** calls endpoints documented for that capability; `web research` does **not** chain `web search` → `web fetch` inside the CLI. Extra body fields go through `--vendor key=value` (repeatable). On `search` / `answer` / `research` you may also pass unregistered `--name value` or `--name=value` (merged with `--vendor`; **same key: `--vendor` wins**). Only **allowlisted** keys per vendor are sent; others are ignored. Shared CLI names: `--country`, `--site` / `--sites`, `--safesearch` (search); unsupported fields are ignored per vendor.

**Multiple `--providers`:** still **separate** official API calls per provider, then client-side merge (different semantics from a single endpoint; see [Multi-provider concurrency](#multi-provider-concurrency)).

---

## Install

### From npm (published)

The CLI is published on the public npm registry as `**@cp7553479/web-cli`**:

- **Package:** [https://www.npmjs.com/package/@cp7553479/web-cli](https://www.npmjs.com/package/@cp7553479/web-cli)

```bash
npm install -g @cp7553479/web-cli
```

This installs the `web` binary globally.

### From source (this repository)

```bash
git clone <this-repo-url>
cd web
npm install
npm run build
```

Register the `web` command globally:

```bash
npm link
```

Verify:

```bash
web --help
web search --help
```

---

## First-time setup

After install, initialize `~/.web/` under your home directory (e.g. `/Users/you/.web/`).

**Fast path — copy templates:**

```bash
web onboard init
```

This copies `init/config.toml` and `init/.env.example` from the repo into `~/.web/` (env file becomes `~/.web/.env`).

Then:

1. Edit `~/.web/.env` with your API keys. The default template enables Jina search and fetch; you need at least `**JINA_API_KEY**` (see links at the top of `init/config.toml` or `init/.env.example`). Add other vendors as needed.
2. Edit `~/.web/config.toml`: uncomment `[*.account.*]` blocks you want. Omitting `enabled` defaults to **on**; set `enabled = false` only to disable an account.

**Interactive wizard:**

```bash
web onboard
```

TTY multi-select and prompts; writes only under `~/.web/`. Not for scripts or CI.

**Re-initialize:**

```bash
web onboard init --force
```

---

## Configuration

### Where files live


| Path                 | Role                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| `~/.web/config.toml` | **Primary config:** which search/fetch/answer/research accounts and in what order. |
| `~/.web/.env`        | **Secrets:** API keys here, not inside `config.toml`.                              |


Optional **project overrides:**


| Path                 | Role                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `./.web/config.toml` | Under project root; **deep-merges** over global; project keys win. |
| `./.web/.env`        | Project env overrides global for same variable names.              |


`**npm test`** integration tests run the CLI from the **repository root**, matching project-level `./.web` above; you need a working `~/.web` (and `./.web` if you use it). External smoke tests require `**WEB_RUN_JINA_SMOKE=1`** (Jina search) and `**WEB_RUN_FETCH_HTTP_SMOKE=1`** (`http` fetch); otherwise those cases are skipped.

> For line-by-line template commentary, open `init/config.toml` and `init/.env.example` in the repo (detailed Chinese comments).

### `config.toml` layout

Four capability sections plus runtime:

```toml
[search]
[fetch]
[research]        # Official research APIs only; [research.account.*]
[answer]
[runtime]
```

Under each capability you mostly have `**[group.account.accountId]**` blocks.

- `**accountId**` (last segment of the header, e.g. `perplexity-main` in `[search.account.perplexity-main]`) is an internal alias; name it however you like.
- **Same vendor, multiple accounts:** multiple blocks with the same `provider` but different `accountId` (e.g. two Tavily keys); order in file is try order / failover.
- **Try order:** first block in file is tried first; on failure, the next runs until success or exhaustion.
- **CLI:** `--provider <vendor or accountId>` limits tries to that vendor (failover among its accounts in file order) or pins one account id. `--account <accountId>` uses exactly one account; with `--provider`, the account must belong to that vendor. `--providers` (multi) cannot be used with `--account`.

`provider` is the **vendor name** (e.g. `jina`, `kimi`, `brave`). The CLI picks the implemented sub-component for the current command (`web search` / `web fetch` / `web answer` / `web research`). A vendor may appear in multiple sections; if it has no implementation for a section, that account is not registered and is skipped during failover.

Example:

```toml
[search]

[search.account.jina-main]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = true

[search.account.tavily-main]
provider = "tavily"
api_token = "{$TAVILY_API_KEY}"
enabled = false
```

To change priority: **move whole `[search.account.xxx]` blocks** in the editor; no separate priority field.

### Placeholders `{$VAR}`

`api_token = "{$TAVILY_API_KEY}"` means: **at startup**, substitute the value of environment variable `TAVILY_API_KEY`.

Resolution order:

1. Existing process env (`export TAVILY_API_KEY=…`)
2. `~/.web/.env`
3. `./.web/.env` (project; overrides above for same names)

**Note:** accounts resolve `{$VAR}` tokens when **not** disabled (`enabled = false`). If `enabled` is omitted, it defaults to **on** (same as `enabled = true`). With `enabled = false`, placeholders are not resolved and keys are not required.

### `[research]`

`web research` reads `**[research.account.*]`** only. Configure vendors that expose an official **research** API (built-in: **tavily**, **perplexity**). Do not put search-only vendors here or you will get “no research accounts” style errors.

---

## Global CLI options

These go between `web` and the subcommand:

```bash
web --timeout-ms 30000 search "query"
```


| Option                 | Default | Purpose                                                                                           |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `-f, --format <fmt>`   | `text`  | `text`, `json`, or `markdown`.                                                                    |
| `--max-length <n>`     | `10000` | Max output characters; tail shows `[truncated]` if cut.                                           |
| `--timeout-ms <n>`     | `15000` | Per-request timeout (default 15s).                                                                |
| (no stderr debug flag) | —       | When `**runtime.logging**` is on (default), requests/responses go to `**<cwd>/.web/logs/*.log**`. |


---

## Commands

### `web search` — web search

```bash
web search "your query"
```

Search-style results: titles, URLs, snippets.


| Option                        | Purpose                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--site github.com npmjs.com` | Restrict to these sites (space-separated).                                                             |
| `--sites …`                   | Same as `--site`; can repeat groups.                                                                   |
| `--country US`                | Unified country/region (mapped if supported).                                                          |
| `--countries US CA`           | Multiple countries; concatenated for `country` if supported.                                           |
| `--safesearch strict`         | Safe search level if supported.                                                                        |
| `--vendor k=v`                | Native vendor fields; repeat; allowlist only.                                                          |
| `--include_answer true` etc.  | Unregistered `--officialField` merges into vendor; `--vendor` wins on conflict.                        |
| `--limit 10`                  | Max results (default 5).                                                                               |
| `--freshness day`             | Recency: `day`, `week`, `month`, `year` (not all vendors).                                             |
| `--language zh`               | Language filter if supported.                                                                          |
| `--region CN`                 | Region filter if supported.                                                                            |
| `--provider xxx`              | Account id or vendor name; default is file order.                                                      |
| `--account xxx`               | Single account id; optional vendor check with `--provider`. Mutually exclusive with `--providers`.     |
| `--providers a b c`           | Concurrent multi-source; merged output. See [Multi-provider concurrency](#multi-provider-concurrency). |


Examples:

```bash
web search "nodejs cli framework" --site github.com npmjs.com --limit 8
web search "AI search API" --provider tavily-main -f markdown
web search "AI search API" --provider kimi --account kimi-main
web search "AI news 2026" --providers jina-main tavily-main
web search "test query"
```

---

### `web fetch` — fetch page content

```bash
web fetch https://example.com
```

One or more URLs; returns extracted body content.


| Options          | Behavior                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| (none)           | **Default:** try `[fetch.account.*]` in file order (`html2markdown`, `http`, `playwright`, etc. per your config). |
| `--provider xxx` | Account id or vendor name (failover among that vendor’s accounts in order).                                       |
| `--account xxx`  | Exactly one account; optional `--provider` vendor check.                                                          |



| Option                     | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `--wait-until load`        | For `playwright`: `load` (default), `domcontentloaded`, or `networkidle`. |
| `--provider xxx`           | Account id or vendor.                                                     |
| `--account xxx`            | Account id.                                                               |
| `--selector "div.article"` | CSS selector slice (Playwright-capable paths).                            |


**html2markdown:** often first in templates; local HTML→Markdown; no API key.

**Long output:** if result exceeds 10,000 characters, full text is written under `.web/temp/*.md` and the terminal shows the path.

Examples:

```bash
web fetch https://example.com
web fetch https://a.com https://b.com --provider jina-reader -f markdown
web fetch https://news.ycombinator.com --provider playwright --wait-until networkidle
web fetch https://example.com/article --provider html2markdown-main
```

---

### `web research` — official deep-research APIs

```bash
web research "your research question"
```

Calls each account’s vendor **research** HTTP API (e.g. Tavily `POST /research` then poll `GET /research/{request_id}`; Perplexity `POST /chat/completions` with `sonar-deep-research` by default). **Does not** locally chain `web search` + `web fetch`.


| Option                   | Purpose                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `--max-sources 6`        | Vendor `limit` hint (semantics vary); default 5.                                                  |
| `--vendor k=v`           | Extension fields; allowlist only (e.g. `--vendor model=sonar-pro`).                               |
| `--model sonar-pro` etc. | Unregistered long flags merge into vendor; `--vendor` wins.                                       |
| `--provider xxx`         | Account id or vendor under `[research.account.*]`.                                                |
| `--account xxx`          | Single research account; not with `--providers`.                                                  |
| `--providers a b c`      | Concurrent research calls; merged. See [Multi-provider concurrency](#multi-provider-concurrency). |


Examples:

```bash
web research "2026 Node.js CLI best practices" --max-sources 6 -f markdown
web research "AI agent frameworks 2026" --providers tavily-main perplexity-main
```

---

### `web answer` — direct answers

```bash
web answer "your question"
```

Not “search results” — vendor **answer** endpoints: DuckDuckGo Instant Answer, Brave Answers, Gemini grounding, Perplexity Sonar (`chat/completions`), Tavily (search + `include_answer`), Firecrawl Interact (requires `--url`), etc.


| Option              | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `<query>`           | **Positional** query text.                                     |
| `--url <url>`       | **Required for Firecrawl interact:** page URL to scrape first. |
| `--vendor k=v`      | Extensions (e.g. `--vendor model=sonar-pro`).                  |
| `--model …` etc.    | Unregistered flags merge into vendor; `--vendor` wins.         |
| `--provider xxx`    | Account id or vendor.                                          |
| `--account xxx`     | Single account; not with `--providers`.                        |
| `--providers a b c` | Concurrent multi-answer; merged.                               |
| `--no-redirect`     | DuckDuckGo: no redirect.                                       |
| `--no-html`         | DuckDuckGo: strip HTML.                                        |
| `--skip-disambig`   | DuckDuckGo: skip disambiguation.                               |


Examples:

```bash
web answer "What is Rust?"
web answer "news summary" --provider gemini-main -f json
web answer "AI trends" --providers ddg-main brave-answer
web answer "extract above-the-fold price" --provider firecrawl-scrape --url https://example.com
```

---

### `web config` — manage configuration

Read/write `~/.web/config.toml` from the CLI (manual edit is still fine).


| Command                                                  | Purpose                           |
| -------------------------------------------------------- | --------------------------------- |
| `web config list`                                        | Show full config (tokens masked). |
| `web config set <group> <accountId> --provider <vendor>` | Add or update an account.         |
| `web config remove-model <group> <accountId>`            | Remove an account.                |


`<group>` is one of `search`, `fetch`, `research`, `answer`.

`set` options:


| Option                 | Purpose                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <vendor>`  | **Required.** e.g. `tavily`, `brave`, `jina`, `kimi`, `firecrawl`, `perplexity`, `gemini`, `duckduckgo`, `http`, `html2markdown`, `playwright`. |
| `--token <secret>`     | API key; literal or `'{$TAVILY_API_KEY}'` (recommended).                                                                                        |
| `--base-url <url>`     | Custom base URL if needed.                                                                                                                      |
| `--enabled true/false` | Default `true`.                                                                                                                                 |


Examples:

```bash
web config list
web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'
web config remove-model search old-alias
```

---

### `web onboard` — first-time wizard


| Command                    | Purpose                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `web onboard init`         | Copy templates to `~/.web/`.                                                                                            |
| `web onboard init --force` | Overwrite `config.toml` / `.env` (merge non-empty env keys back); refresh `~/.web/README.md` and `~/.web/README_CN.md`. |
| `web onboard`              | Interactive wizard (TTY).                                                                                               |


---

### `web plugins` — list external plugins

```bash
web plugins list
```

Lists external packages under `~/.web/plugins/`.

**Most users do not need this.** Built-in vendors cover typical use; plugins are for custom/private integrations.

---

## Multi-provider concurrency

`--providers` works for `search`, `answer`, and `research`. Compared to `--provider` (singular):


|          | `--provider xxx`                                                     | `--providers a b c`                                               |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Behavior | Single logical choice; failover to next account in chain on failure. | Concurrent requests to `a`, `b`, `c`; merge successful responses. |
| Use when | You want one primary line / vendor scope.                            | You want combined perspectives (e.g. Jina + Tavily).              |


`**--account`** is only valid with single-path mode (`--provider` or default order), **not** with `--providers`.

Names after `--providers` can be:

- **Account id** (`[search.account.here]` segment), e.g. `jina-main`, `tavily-main`.
- **Vendor name** (`tavily`, `jina`, …); resolves to matching accounts.

Wrong names produce a hint:

```
Unsupported provider 'xxx'. Available for search: jina-main, tavily-main, brave-main, jina, tavily, brave
```

Examples:

```bash
web search "latest AI papers" --providers jina-main tavily-main
web answer "what is quantum computing" --providers ddg-main brave-answer
web research "2026 frontend trends" --providers jina-main tavily-main --max-sources 8
```

---

## Output formats

`-f` / `--format`:


| Format     | Best for          | Shape                                   |
| ---------- | ----------------- | --------------------------------------- |
| `text`     | Human terminal    | Numbered list with title, URL, snippet. |
| `markdown` | Docs / notes      | Markdown headings and lists.            |
| `json`     | Programs / agents | JSON.                                   |


```bash
web search "hello" -f json
web search "hello" -f markdown
web search "hello"
```

---

## Logging

Default **on**. Logs go to `<cwd>/.web/logs/`, files like `YYYY-MM-DD-<id>.log`, including command line, requests, and responses.

Disable: in `~/.web/config.toml` under `[runtime]`, set `logging = false`.

---

## Inject prompt

Per capability section you can set `inject_before` / `inject_after` in TOML to wrap output (useful for agent prompts).

```toml
[search]
inject_before = "The following results are from Internet searches, for reference only and may not be authentic:"
inject_after = ""
```

Set independently for `search`, `fetch`, `research`, `answer`.

---

## Troubleshooting

### Logs first

There is no verbose stderr stream. With `runtime.logging` (default), open `**<cwd>/.web/logs/*.log**` for requests, responses, and stacks.

### Common errors


| Message                                                                | Cause                                                 | What to do                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `环境变量未设置: TAVILY_API_KEY` (example)                                    | Account not disabled (`enabled` omitted or true) but key missing in `~/.web/.env`.     | Add key or set `enabled = false` for that account.                                      |
| `search: all configured accounts failed…`                              | Entire search chain failed or no search registration. | Check `<cwd>/.web/logs/`; verify `[search.account.*]` and keys.                         |
| `research: no accounts configured…`                                    | No `[research.account.*]`.                            | Add tavily / perplexity research accounts.                                              |
| `research: configured account(s) use provider(s) that do not support…` | Research section has non-research vendors.            | Use `provider = "tavily"` or `perplexity`.                                              |
| `Unsupported provider 'xxx'. Available for …`                          | Bad `--provider` / `--providers` name.                | Fix using the listed names.                                                             |
| `All fetch providers failed`                                           | Entire fetch chain failed.                            | Check logs; reorder or fix `[fetch.account.*]`; narrow with `--provider` / `--account`. |


---

## Built-in providers

`provider = "xxx"` is the vendor name; the CLI selects the component for the current capability.


| Vendor          | Service                | Capabilities                                                                                                                                                                                                                                                                                  | Docs / keys                      |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `jina`          | Jina                   | search, [Reader fetch](https://r.jina.ai/docs)                                                                                                                                                                                                                                                | [Search](https://s.jina.ai/docs) |
| `tavily`        | Tavily                 | search (`[include_answer](https://docs.tavily.com/documentation/api-reference/endpoint/search)`), [extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract) fetch, [research](https://docs.tavily.com/documentation/api-reference/endpoint/research), answer via search | `TAVILY_API_KEY`                 |
| `brave`         | Brave                  | [Web search](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started), [Answers](https://api-dashboard.search.brave.com/documentation/services/answers)                                                                                                               | `BRAVE_API_TOKEN`                |
| `kimi`          | Kimi / Moonshot        | search ([web_search / tools](https://platform.kimi.com/docs/guide/use-web-search)), fetch (formula)                                                                                                                                                                                           | `MOONSHOT_API_KEY`               |
| `firecrawl`     | Firecrawl              | [search](https://docs.firecrawl.dev/features/search), [scrape](https://docs.firecrawl.dev/features/scrape) fetch, [interact](https://docs.firecrawl.dev/features/interact) answer (needs `--url`)                                                                                             | `FIRECRAWL_API_KEY`              |
| `perplexity`    | Perplexity             | [Search](https://docs.perplexity.ai/docs/search/quickstart), [Sonar answer](https://docs.perplexity.ai/docs/sonar/pro-search/quickstart), [Sonar research](https://docs.perplexity.ai/docs/sonar/quickstart)                                                                                  | `PERPLEXITY_API_KEY`             |
| `html2markdown` | Built-in engine        | fetch                                                                                                                                                                                                                                                                                         | —                                |
| `http`          | Direct HTTP GET        | fetch                                                                                                                                                                                                                                                                                         | —                                |
| `playwright`    | Headless Chromium      | fetch                                                                                                                                                                                                                                                                                         | —                                |
| `duckduckgo`    | DuckDuckGo             | answer                                                                                                                                                                                                                                                                                        | —                                |
| `gemini`        | Gemini + Google Search | answer                                                                                                                                                                                                                                                                                        | `GEMINI_API_KEY`                 |


Key signup URLs are also listed at the top of `init/config.toml` and `init/.env.example`.

HTTP-level curl examples: `[docs/provider-curl-mapping.md](docs/provider-curl-mapping.md)` (optional deep dive).

---

## More documentation


| Doc                                                                  | Audience             | Content                              |
| -------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| `[docs/onboard.md](docs/onboard.md)`                                 | Config merge details | Onboarding, global vs project merge. |
| `[docs/provider-curl-mapping.md](docs/provider-curl-mapping.md)`     | Debugging HTTP       | Curl-shaped examples per vendor.     |
| `[docs/plugin-protocol.md](docs/plugin-protocol.md)`                 | Plugin authors       | Layout and protocol.                 |
| `[CLAUDE.md](CLAUDE.md)`                                             | Contributors         | Repo rules and boundaries.           |
| `[SOUL.md](SOUL.md)`                                                 | Design intent        | Product principles.                  |
| `[.claude/skills/web-cli/SKILL.md](.claude/skills/web-cli/SKILL.md)` | AI agents            | How agents invoke this CLI.          |


---

## Why this project

Every agent stack needs search and fetch, but keys and adapters end up duplicated across tools.

This project puts **search, fetch, answer, and research behind one `web` command**: configure once, reuse everywhere, failover across accounts.