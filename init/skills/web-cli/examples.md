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

## 3) 抓取网页正文

用户意图：拿到网页主体内容

```bash
web fetch https://example.com -f markdown --max-length 12000
```

## 4) 一次抓多个 URL

用户意图：批量抓取，结果按 URL 顺序合并输出

```bash
web fetch https://a.com https://b.com -f markdown
```

## 5) 抓取动态页面（Playwright 账号）

用户意图：抓 JS 渲染页面（需先 `npm install -g playwright`）

```bash
web config set fetch pw --provider playwright
web fetch https://news.ycombinator.com \
  --account pw \
  --wait-until networkidle \
  --selector "body" \
  -f markdown
```

## 6) 免 API key 抓取（本地 Readability 转 Markdown）

用户意图：不消耗厂商额度，本地把网页转成干净 Markdown

```bash
web config set fetch local --provider html2markdown
web fetch https://en.wikipedia.org/wiki/Readability --account local -f text
```

## 7) 厂商原生参数（--vendor，按 provider 白名单过滤）

```bash
web search "AI news" --account tavily-main --vendor search_depth=advanced
web search "latest model releases" --account pplx --vendor model=sonar-pro
web fetch https://example.com --account fc --vendor onlyMainContent=true
```

## 8) 配置多账号 failover（密钥池）

用户意图：同厂商多 key 轮换

```bash
web config set search tavily-1 --provider tavily --token '{$TAVILY_API_KEY}'
web config set search tavily-2 --provider tavily --token '{$TAVILY_API_KEY_BACKUP}'
web config use search tavily-1
# current.json 指针让 tavily-1 优先；失败后自动轮换 tavily-2，再按声明顺序试其余账号
```

## 9) 项目级覆写

用户意图：某个仓库用不同账号/参数（手写项目 overlay 文件，deep-merge 覆写全局）

```jsonc
// ./.web/config.json
{
  "search": {
    "account": {
      "proj-brave": { "provider": "brave", "api_token": "{$BRAVE_API_KEY}" }
    }
  }
}
```

项目目录下还可用 `./.web/.env` 放项目专用 key；`{$VAR}` 解析顺序：
process.env ← `~/.web/.env` ← `./.web/.env`（后者覆盖前者）。

## 10) JSON 输出给程序消费

```bash
web search "node.js" -f json --limit 3
```
