# Web CLI Provider Curl Mapping

本项目只面向官方 API（或官方公开端点），默认通过 HTTP 请求直连，不依赖官方 SDK。

provider 字段填厂商名，CLI 根据能力段上下文自动选用对应组件。

`web fetch` 通过 `--provider` / `--account` 与 `config.toml` 里 `[fetch.account.*]` 的声明顺序选择账号；需 HTTP 直连或 Playwright 时在配置中声明对应 `provider = "http"` / `"playwright"` 的 account 即可。

## Search

### Brave (`provider=brave`)

```bash
curl "https://api.search.brave.com/res/v1/web/search?q=typescript+cli&count=5" \
  -H "X-Subscription-Token: $BRAVE_API_TOKEN"
```

### Tavily (`provider=tavily`)

```bash
curl -X POST "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"typescript cli","max_results":5,"include_answer":true}'
```

### Tavily Extract（`provider=tavily`，fetch 上下文）

```bash
curl -X POST "https://api.tavily.com/extract" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"],"format":"markdown"}'
```

### Tavily Research（`provider=tavily`，research 上下文）

异步任务：`POST /research` 得 `request_id` 后 `GET /research/{request_id}` 轮询至 `completed`（见 [Tavily Research API](https://docs.tavily.com/documentation/api-reference/endpoint/research)）。

```bash
curl -X POST "https://api.tavily.com/research" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"What are the latest developments in AI?","model":"auto","stream":false}'
```

### Firecrawl (`provider=firecrawl`)

```bash
curl -X POST "https://api.firecrawl.dev/v2/search" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"typescript cli","limit":5}'
```

### Perplexity (`provider=perplexity`)

```bash
curl -X POST "https://api.perplexity.ai/search" \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"typescript cli","max_results":5}'
```

### Jina Search（`provider=jina`）

`s.jina.ai` 请求；正式环境应在 Header 携带 `Authorization: Bearer $JINA_API_KEY`（与官方计费策略一致，密钥在 [jina.ai](https://jina.ai/) 申请）。

```bash
curl "https://s.jina.ai/?q=typescript+cli" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

### Kimi (`provider=kimi`)

官方 Formula 流程（节选）：先拉工具声明，再 `chat/completions`，若 `finish_reason=tool_calls` 则对每条调用 `POST /formulas/{uri}/fibers`，将 `encrypted_output` 或 `output` 以 `role=tool` 回填后再请求下一轮。`{uri}` 需 URL 编码，例如 `moonshot%2Fweb-search%3Alatest`。

```bash
export MOONSHOT_BASE_URL="https://api.moonshot.cn/v1"
export URI_ENC="moonshot%2Fweb-search%3Alatest"

curl "${MOONSHOT_BASE_URL}/formulas/${URI_ENC}/tools" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY"

curl -X POST "${MOONSHOT_BASE_URL}/chat/completions" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.5","messages":[{"role":"user","content":"typescript cli 最新动态"}],"tools":[...]}'
```

## Fetch

### html2markdown (`provider=html2markdown`)

本地处理，无外部 API 调用。流程：HTTP GET 获取 HTML → Mozilla Readability 提取正文 → Turndown 转 Markdown。

```bash
# 等效于直接 HTTP 获取后本地处理
curl "https://example.com"
# → Readability 提取正文 → Turndown 转为 Markdown
```

### playwright (`provider=playwright`)

本地启动 Chromium，无独立 HTTP API。抓取编排入口：`src/providers/playwright-fetch.ts`；浏览器与会话细节：`src/fetch/playwright.ts`。

### HTTP (`provider=http`)

```bash
curl "https://example.com"
```

### Jina Reader（`provider=jina`，fetch 上下文）

`r.jina.ai`；建议携带 API Key：

```bash
curl "https://r.jina.ai/http://example.com" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

### Firecrawl Scrape (`provider=firecrawl`)

```bash
curl -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","formats":["markdown"]}'
```

### Kimi Fetch (`provider=kimi`)

与 Search 相同编排，Formula 使用 `moonshot/fetch:latest`（路径中 URI 需编码为 `moonshot%2Ffetch%3Alatest`）。

## Answer

### DuckDuckGo (`provider=duckduckgo`)

```bash
curl "https://api.duckduckgo.com/?format=json&q=What+is+Rust%3F&no_redirect=1&no_html=1&skip_disambig=1"
```

### Brave (`provider=brave`)

```bash
curl "https://api.search.brave.com/res/v1/answers/search?q=What+is+Rust%3F" \
  -H "X-Subscription-Token: $BRAVE_API_TOKEN"
```

### Tavily（`provider=tavily`，answer 上下文）

与 Search 同源：`POST https://api.tavily.com/search`，`include_answer` 为 `true` / `basic` / `advanced`。

### Perplexity Sonar（`provider=perplexity`，answer 上下文）

OpenAI 兼容：`POST https://api.perplexity.ai/chat/completions`，`model` 如 `sonar-pro`。

### Firecrawl Interact（`provider=firecrawl`，answer 上下文）

先 `POST /v2/scrape` 取 `scrapeId`，再 `POST /v2/scrape/{scrapeId}/interact` 传 `prompt`。见 [Interact](https://docs.firecrawl.dev/features/interact)。

### Gemini + Google 搜索接地 (`provider=gemini`)

官方 REST：`generateContent`，请求体含 `tools: [ { "google_search": {} } ]`，响应 `candidates[].groundingMetadata` 含检索片段与引用。详见 [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)。

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"What is Rust?"}]}],"tools":[{"google_search":{}}]}'
```

## Research

### Tavily（`provider=tavily`）

见上文 **Tavily Research**：`POST /research` 与 `GET /research/{request_id}`。

### Perplexity（`provider=perplexity`）

`POST https://api.perplexity.ai/chat/completions`，`model` 如 `sonar-deep-research`（可用 `--vendor model=...` 覆盖）。见 [Sonar quickstart](https://docs.perplexity.ai/docs/sonar/quickstart)。
