[English](README.md)

# web-cli

统一的 **网页搜索** + **网页抓取** CLI，构建在可移植的 provider 池核心之上。
一次配置，多家 provider（Tavily、Brave、Jina、Firecrawl、Perplexity……），
HTTP 走系统 `curl`。

> **v2 是破坏性重写。** 配置改为 JSON（`~/.web/config.json`）；`research` 与
> `answer` 命令以及 Kimi provider 已移除；HTTP 全部经由 `curl`。权威需求见
> [`SPEC.md`](./SPEC.md)。

## 安装

```bash
npm install -g @cp7553479/web-cli
web --version
```

需要 PATH 里有 `curl`（macOS 与大多数 Linux 发行版自带）。
可选：`npm install -g playwright` 用于抓取 JS 渲染页面。

## 快速开始

```bash
web config init                                       # 写出 ~/.web/config.json + .env
web config set search tavily-main --provider tavily --token 'tvly-...'
web config set fetch jina-reader --provider jina --token 'jina_...'

web search "nodejs cli framework" --site github.com --limit 8
web search "AI news" --provider tavily-main -f markdown
web fetch https://example.com -f markdown
web config doctor                                     # 自检
web provider list                                     # 查看内置 + 插件 provider
```

密钥可写明文，也可写 `{$ENV_VAR}` 引用（依次从进程环境变量、`~/.web/.env`、
`./.web/.env` 解析）。

## 命令

| 命令 | 作用 |
|---|---|
| `web search <query>` | 通过已配置账号进行网页搜索（官方 API） |
| `web fetch <urls...>` | 抓取网页内容（curl / API / 浏览器） |
| `web config {init\|path\|show\|list\|set\|remove\|use\|doctor}` | 管理 `~/.web/config.json` 与 `current.json` |
| `web provider {list\|models}` | 查看 provider |

全局 flag：`-f, --format json|markdown|text`、`--max-length <n>`、
`--timeout-ms <n>`。search/fetch 支持 `--provider <别名或厂商名>` 与
`--account <别名>` 锁定账号；不指定时按声明顺序逐一尝试并分类记录故障转移。

## 故障转移（failover）如何工作

任何 provider 失败时，`web` 会记录一个 `FailureClass`
（`retryable-credential` / `retryable-transport` / `non-retryable-request` /
`unsupported` / `unknown`）用于诊断，并**推进到下一个已配置账号**。只有全部
尝试过后才失败（`*_ALL_FAILED`，附各账号明细）。轮换是无条件的 —— 仅凭 HTTP
状态码判断不可靠（例如 Brave 对无效 token 返回 422，这是账号级错误，必须
轮换）。

每次尝试都记录到 `~/.web/logs`（或 `./.web/logs`）。详见
[`docs/error-handling.md`](./docs/error-handling.md)。

## 架构

```
src/core/    可移植抽象层（零向上依赖；拷走即可复用到其它 CLI）
  protocol/  FailureClass、ProviderHooks、ProviderPool、PluginHost
  transport/ Transport 接口 + CurlTransport
  config/    按 appName 参数化的加载器 + {$ENV} 解析
  cli/ output/ logger/ errors.ts
src/web/     web 领域层（依赖 core）
  cli/commands/  search、fetch、config、provider
  protocol/      SearchRequest/FetchRequest/ResultItem + 校验
  providers/     brave、tavily、jina、firecrawl、perplexity、http、html2markdown、playwright
  config/        JSON schema、默认值、materialize → 按能力实例化池
```

core 对 `<Req, Res>` 泛型，从不出现 "search"/"fetch" 字样；web 层实例化两个
类型化池。边界规则见 [`docs/architecture.md`](./docs/architecture.md) 与
[`AGENTS.md`](./AGENTS.md)。

## 配置

`~/.web/config.json`（全局）+ 可选 `./.web/config.json`（项目覆写）：

```json
{
  "runtime": { "logging": true },
  "search": { "account": {
    "tavily-main": { "provider": "tavily", "api_token": "{$TAVILY_API_KEY}" }
  } },
  "fetch": { "account": {
    "jina-reader": { "provider": "jina", "api_token": "jina_..." }
  } }
}
```

`web config use <group> <alias>` 把活动默认账号写入单独的 `current.json`。

## 插件

外部 provider 以 CommonJS 模块形式放在 `~/.web/plugins/<id>/plugin.json`，
在 `activate` 里调用 `api.registerProvider(name, factory)`。详见
[`docs/plugin-protocol.md`](./docs/plugin-protocol.md)。

## 开发

```bash
npm run build         # tsc → dist/
npm test              # build + vitest（unit + integration）
npm run test:unit     # core pool/config/classification/vendor-params
```

外网烟测由 `WEB_RUN_FETCH_HTTP_SMOKE=1` 门控，默认跳过。

## 许可证

MIT
