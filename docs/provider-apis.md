# Provider API contracts

> Verified against official docs (Aug 2026). When a provider changes, update
> this file, the implementation in `src/web/plugins/builtin/<name>.ts`, and `SPEC.md`.

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

## Exa

- **Endpoint**: `POST https://api.exa.ai/search`
- **Auth**: `x-api-key: …` (or `Authorization: Bearer …`)
- Body: `query` (required), `numResults` (default 10), `includeDomains` (array,
  used for `--site`), `startPublishedDate` (ISO date, derived from
  `--freshness`: day=1 / week=7 / month=30 / year=365 days back), optional
  vendor params: `category`, `type`, `userLocation`, `moderation`.
- Response: `results[]` with `title` (required), `url` (required),
  `publishedDate`, `text` / `summary` (only when contents are requested).
- Verified against exa.ai official docs (2026-09-20).

## Serper

- **Endpoint**: `POST https://google.serper.dev/search`
- **Auth**: `X-API-KEY: …`
- Body: `q` (required; `site:` operators appended for `--site`), `num`,
  `gl` (from `--country`), `hl` (from `--language`), optional vendor params:
  `location`, `page`, `tbs`.
- Response: `organic[]` with `title`, `link`, `snippet`, `position`, `date`;
  other blocks (`knowledgeGraph`, `answerBox`, `peopleAlsoAsk`) ignored.
- **Images** (`web search-image`): `POST https://google.serper.dev/images`,
  same auth; body `{q, num, gl, hl}`; response `images[]` with `title`,
  `imageUrl`, `imageWidth`/`imageHeight`, `thumbnailUrl`, `link` (source page),
  `source`.
- Verified against apis.io/LangChain-documented shape (2026-09-20).

## Pixabay

- **Endpoint**: `GET https://pixabay.com/api/?key=…&q=…&per_page=…&safesearch=true`
- **Auth**: free API key passed as the `key` query parameter.
- Vendor params: `image_type`, `category`, `lang`, `colors`, `orientation`,
  `min_width`, `min_height`.
- Response: `hits[]` with `webformatURL`, `largeImageURL`, `pageURL` (Pixabay
  page), `tags` (used as the item title/alt).
- Rate limit ~100 req / 60 s per key. Verified against official API docs
  (2026-09-20).

## Pexels

- **Endpoint**: `GET https://api.pexels.com/v1/search?query=…&per_page=…`
- **Auth**: `Authorization: <API_KEY>` (free key from pexels.com account).
- Vendor params: `orientation`, `size`, `color`, `page`.
- Response: `photos[]` with `src` (`original`/`large2x`/`large`/…), `alt`,
  `photographer`, `url` (page).
- Verified against official API docs (2026-09-20).

## SearXNG (self-hosted)

- **Endpoint**: `GET {base_url}/search?q=…&format=json`
- **Auth**: none (instance may require its own gateway).
- `base_url` is REQUIRED on the account (self-hosted instance); `format=json`
  must be enabled in the instance's `settings.yml` (`search.formats`),
  otherwise the instance answers 403.
- Vendor params: `categories`, `language`, `safesearch`, `pageno`, `time_range`.
- Response: `results[]` with `url`, `title`, `content` (+ engine metadata).
- Verified against SearXNG docs / OpenWebUI integration notes (2026-09-20).

## Ask (LLM) providers

All `ask` vendors, their protocols, default bases, models and web-search tool
schemas are tabulated in `SPEC.md` §5 ("Ask (LLM) vendors"). Each plugin
injects a fixed English instruction: answer from live web search, cite inline
as `[N]`, end with a `Sources:` list in the form `[N] <title> - <URL>`.

Live-verified 2026-09-20 (connectivity, latest lightweight models):
deepseek (deepseek-chat), openrouter (moonshotai/kimi-k2.6 + web plugin),
zai (glm-4.5-flash + web_search), zhipu coding plan via the OpenAI Responses
protocol at open.bigmodel.cn/api/v1 (glm-4.6), kimi (kimi-k3 + $web_search
builtin), minimax / gemini / chatgpt / grok / bailian (auth + routing reach
the vendor API; blocked only by account credits/balance). Volcengine ark keys
authenticate; callable model ids must match the models granted in the
Volcengine console (plan endpoint rejected doubao-evolop-latest).

Note: zhipu/zai coding plans are plain REST protocols (Anthropic Messages and
OpenAI Responses / Chat Completions) — no MCP handshake required for API use.

## Zhipu (BigModel) Web Search

- **Endpoint**: `POST https://open.bigmodel.cn/api/paas/v4/web_search`
- **Auth**: `Authorization: Bearer <key>`
- Body: `search_query` (required, max 70 chars), `search_engine`
  (`search_std` | `search_pro` | `search_pro_sogou` | `search_pro_quark`),
  `search_intent` (boolean), `count` (1–50), `search_domain_filter`,
  `search_recency_filter` (`oneDay|oneWeek|oneMonth|oneYear|noLimit`),
  `content_size` (`medium|high`).
- Response: `search_result[]` with `title`, `content` (summary), `link`,
  `media` (site name), `icon`, `refer` (citation index), `publish_date`.
- Verified against official docs (2026-09-20); live call reaches the API
  (1113 = no active search resource pack on the key).

## Volcengine Ark / MiniMax tool extraction

Both vendors have no standalone search endpoint; the search capability calls
their chat APIs with the vendor web-search tool and extracts citations:

- **volcengine**: `POST {ark}/v3/chat/completions` (Bearer), body carries
  `tools: [{type: "web_search"}]`; results are read from
  `choices[].message.annotations` (`title`/`url`). The account's
  console-granted models apply (ungranted ids return
  `InvalidEndpointOrModel.NotFound`).
- **minimax**: `POST https://api.minimax.chat/anthropic/v1/messages`
  (`x-api-key` + `anthropic-version`), body carries
  `tools: [{type: "web_search_20250305", name: "web_search"}]`; results are
  read from `content[]` blocks of type `web_search_tool_result`
  (`{title, url}` items).
- Verified live 2026-09-20 (auth and request shape accepted; blocked only by
  console model grants / balance).

## Bailian web-search MCP (not integrated)

Bailian exposes network search as an MCP service enabled per-account in the
Bailian console (MCP marketplace; 2000 free calls then metered). The MCP
endpoint URL is provisioned per account and is not publicly documented in a
programmable form, so it is not integrated. Enable the service in the console
and point a custom plugin at the provisioned URL if needed.

## Not supported

- **Bing Web Search** — Microsoft retired the API (Aug 2025); no new signups.
- **DuckDuckGo** — no official API; only HTML scraping, which we don't do.
- **Kagi** — official API exists but requires a paid consumer subscription.
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
