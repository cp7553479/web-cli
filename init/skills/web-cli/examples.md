# Web CLI Skill Examples

## 1) 快速文档检索

用户意图：查找某技术官方文档

```bash
web search "TypeScript 6 release notes" \
  --site typescriptlang.org github.com \
  --limit 6 \
  -f markdown
```

## 2) 多域名搜索（中文）

用户意图：找中文资料并限定站点

```bash
web search "Moonshot Kimi API 文档" \
  --site platform.moonshot.ai docs.moonshot.ai \
  --language zh \
  --limit 5
```

## 3) 抓取网页正文（provider 模式）

用户意图：拿到网页主体内容

```bash
web fetch https://example.com \
  --provider jina-reader \
  -f markdown \
  --max-length 12000
```

## 4) 抓取网页正文（HTTP 直连 account）

用户意图：使用配置里 `provider = "http"` 的 fetch 账号

```bash
web fetch https://example.com --provider http -f text
```

## 5) 抓取动态页面（Playwright）

用户意图：抓 JS 渲染页面

```bash
web fetch https://news.ycombinator.com \
  --provider playwright \
  --wait-until networkidle \
  --selector "body" \
  -f markdown
```

## 6) 研究型任务

用户意图：调用厂商 **research** API（需在 `[research.account.*]` 配置 tavily 或 perplexity）

```bash
web research "2026 search API pricing comparison" \
  --max-sources 6 \
  --cite \
  -f markdown
```

## 7) 问答型任务（DuckDuckGo）

用户意图：快速事实问答

```bash
web answer \
  "What is Rust language?" \
  --provider ddg-main \
  --no-html \
  --skip-disambig
```

## 8) 问答型任务（Brave Answers）

用户意图：用 Brave answers 接口

```bash
web answer \
  "latest TypeScript version" \
  --provider brave-answer \
  -f json
```

## 9) 抓取网页正文（Readability 本地转换）

用户意图：用内置 Readability + Turndown 把网页转成干净 Markdown

```bash
web fetch https://en.wikipedia.org/wiki/Readability \
  --provider html2markdown-main \
  -f text
```

## 10) 多源并发搜索

用户意图：同时用多个搜索引擎搜同一关键词，合并结果

```bash
web search "AI agent frameworks 2026" \
  --providers jina-main tavily-main \
  -f markdown
```

## 11) 多源并发问答

用户意图：同时向多个问答服务提问

```bash
web answer \
  "什么是量子计算" \
  --providers ddg-main brave-answer
```

## 12) 多源并发研究

用户意图：多个 **research** provider 并发（均为已注册的 research 账号，例如两个 tavily 或 tavily+perplexity）

```bash
web research "2026 前端框架趋势" \
  --providers tavily-main perplexity-main \
  --max-sources 8 \
  -f markdown
```

## 13) 配置模型与顺序

用户意图：配置 token 池并设优先级

```bash
web config set search kimi-1 \
  --provider kimi \
  --token '{$MOONSHOT_API_KEY}'

web config set search kimi-2 \
  --provider kimi \
  --token '{$MOONSHOT_API_KEY_BACKUP}'

# 先试 kimi-1 再试 kimi-2：在 ~/.web/config.toml 里把 [search.account.kimi-1] 整块写在 [search.account.kimi-2] 上面
```
