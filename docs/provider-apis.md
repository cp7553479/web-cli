# Provider API contracts

> Verified against official docs (Aug 2026). When a provider changes, update
> this file, the implementation in `src/web/providers/<name>.ts`, and `SPEC.md`.

## Tavily

- **Search**: `POST https://api.tavily.com/search`
- **Extract**: `POST https://api.tavily.com/extract`
- **Auth**: `Authorization: Bearer tvly-…` (no `/v1` path prefix)
- Search body: `query`, `max_results`, `topic`, `search_depth`, `time_range`
  (`day|week|month|year`), `include_domains`, `exclude_domains`, `country`,
  `include_answer` (`bool|"basic"|"advanced"`), `include_raw_content`, `chunks_per_source`.
- Search response: `results[]` (`title/url/content/score/raw_content`), optional
  top-level `answer`.
- Extract body: `urls`, `format: "markdown"`, `extract_depth`, `chunks_per_source`, `query`.
- Extract response: `results[]` (note: content field is **`raw_content`**),
  `failed_results[]` (`url/error`).
- Errors: 429 with `retry-after`; body `{"error": "..."}`.

## Brave Search

- **Search**: `GET https://api.search.brave.com/res/v1/web/search`
- **Auth**: `X-Subscription-Token: <key>`
- Params: `q`, `count`, `country`, `search_lang`, `freshness` (`pd|pw|pm|py`),
  `safesearch` (`off|moderate|strict`), `extra_snippets`, `goggles` (**not** the
  deprecated `goggles_id`), `offset`, `result_filter`.
- Response: `web.results[]` (`title/url/description/extra_snippets`); ranked
  order in `mixed`; images inside `web.results[].deep_results.images`.
- No include-domains field — append `site:<domain>` operators to `q`.

## Jina

- **Search**: `GET https://s.jina.ai/<query>` (optional `?site=`)
- **Reader**: `GET https://r.jina.ai/<url>`
- **Auth**: `Authorization: Bearer jina_…`
- Use `Accept: application/json`. Reader format header is **`x-respond-with`**
  (NOT `X-Return-Format`); wait header is **`x-wait-for-selector`**.
- Search response: `data` is an **array** of up to 5 `{title,url,content}`.
- Reader response: `data` is a single object `{title,url,content}`.

## Firecrawl (v2)

- **Search**: `POST https://api.firecrawl.dev/v2/search`
- **Scrape**: `POST https://api.firecrawl.dev/v2/scrape`
- **Auth**: `Authorization: Bearer …`
- Search body: `query`, `limit`, `includeDomains`/`excludeDomains`, `tbs`
  (Google-style time filter, e.g. `qdr:d`), `country` (**no** `timeRange`/`lang`).
- Search response: `data.web[]` / `data.images[]` / `data.news[]` (keyed by
  source type — NOT a flat `data[]`); `{success, error}` on failure.
- Scrape body: `url`, `formats: ["markdown"]`, `onlyMainContent`, `includeTags`,
  `waitFor`, `actions`.
- Scrape response: `data.markdown`, `data.metadata.{title,sourceURL,url}`.

## Perplexity (Sonar)

- **Endpoint**: `POST https://api.perplexity.ai/v1/sonar`
  (`/chat/completions` accepted as an alias).
- **Auth**: `Authorization: Bearer …`
- Models: `sonar`, `sonar-pro`, `sonar-reasoning-pro`, `sonar-deep-research`
  (`sonar-research`/`sonar-reasoning` are deprecated).
- Body: `model`, `messages`, `search_recency_filter`
  (`hour|day|week|month|year`), `search_domain_filter` (array), `search_mode`,
  `reasoning_effort`.
- Response: `choices[].message.content` (grounded answer), top-level `citations`
  (URL strings), `search_results[]` (`title/url/snippet`). **`return_citations`
  is not a valid param.**

## Not supported in v1

- **Moonshot/Kimi** — no standalone search API; only grounded chat with encrypted
  payloads. Not a `{title,url,snippet}` source.

## Transport notes (curl)

The default transport spawns the system `curl`. We intentionally do NOT use
`--fail-with-body`: we want curl to exit 0 for any HTTP response (including
4xx/5xx) so the provider's `parseResponse` can inspect the status and body and
throw a classified `ProviderError`. curl exits non-zero only for genuine
transport failures (DNS/timeout/connection), which classify as
`retryable-transport`. Recommended baseline flags used: `-sS --location
--max-time --dump-header @tmp --data-binary @tmpjson` (or `--form`).
