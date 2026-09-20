[English](README.md)

# web-cli

为终端和 AI Agent 提供可靠的网页搜索与抓取——一份配置文件，多家 provider，
任何一家出问题时自动切换。

## 为什么需要 web-cli

把 Agent 或脚本接上互联网的人，迟早会撞上同一堵墙：某一家搜索 API 用得好好的，
直到它限流、key 过期、配额耗尽——下游的一切跟着瘫痪。就算顺利，多数 API 返回的
原始 JSON 也得先加工一番，Agent 才能用得起来。

web-cli 把你已经有账号的那些 provider——Tavily、Brave、Jina、Firecrawl、
Perplexity、Exa、Serper，乃至你自建的 SearXNG——变成同一条命令。在一份纯文本配置里写清账号，从此 `web search` 和
`web fetch` 直接可用，而且持续可用：一个账号失败，下一个自动顶上；失败的账号
冷却十五分钟后自行恢复。全部走官方 API 的纯 HTTP 调用——不引 SDK，不做爬取。

输出面向使用方而非 API：默认干净整洁的 Markdown（也支持 JSON 和纯文本），
大小有界，不会撑爆终端或上下文窗口；超长的结果自动存成文件，只打印路径。

## 核心特性

- **真正可用的故障转移** —— 每个 provider 可配多条 key 的账号池，优先级由你
  决定，15 分钟冷却跨重启生效，且保证在遍历完全部账号后停止
- **图片搜索** —— `web search-image` 支持 Pixabay、Pexels、Serper，同一套
  配置、故障转移与优先级模型
- **带着实时联网问大模型** —— `web ask` 在 12 家厂商间调度（ChatGPT、Gemini、
  Claude、Grok、Kimi、DeepSeek、豆包、通义、MiniMax、OpenRouter、GLM 等）；
  每个插件注入各家的 web_search 工具，回答自带编号引用与来源列表
- **对 Agent 友好的输出** —— 默认 Markdown，`--format json|markdown|text`，
  永远有界，不会向上下文倾倒无边界内容
- **一份配置文件** —— 账号、密钥（支持 `{$ENV_VAR}` 引用）、provider 优先级、
  按 provider 开关
- **自带 provider 也行** —— 一个很小的插件契约接入任何未内置的服务，包括提供
  多个 base URL 的 provider
- **只用官方 API** —— 纯 HTTP 走系统 `curl`，不爬取任何页面

## 安装

```bash
npm install -g @cp7553479/web-cli
web --version
```

## 快速开始

```bash
web config init                                       # 写出 ~/.web/config.json + .env + agent skills
web config add search tavily-main --provider tavily --token 'tvly-...'
web config add search tavily-backup --provider tavily --token 'tvly-backup-key'

web search "nodejs cli framework" --site github.com --limit 8
web search "AI news" -f markdown
web fetch https://example.com
web search-image "sunset over mountains" --limit 10   # 图片搜索（pixabay / pexels / serper）
web ask "what changed in nodejs 24?" --model gemini/gemini-flash-latest
web doctor --fix                                     # 自检 + 自动修复
web update --check                                   # 检查新版本
web provider list                                    # 查看内置 + 插件 provider
```

`web config add` 会按 provider 的配置项逐步引导（接入点、密钥）；在脚本中追加
`--field key=value` 即可免交互作答。

## 命令

| 命令 | 作用 |
|---|---|
| `web search <query>` | 通过已配置账号进行网页搜索（官方 API） |
| `web fetch <urls...>` | 抓取网页内容（curl / API / 浏览器；其他方式失效时自动浏览器兜底） |
| `web search-image <query>` | 图片搜索（pixabay / pexels / serper） |
| `web ask <question>` | 调用大模型并注入原生联网搜索工具，回答自带引用 |
| `web config {init\|add\|path\|show\|list\|set\|remove\|use}` | 管理 `~/.web/config.json` 与 `current.json` |
| `web doctor [--json] [--fix]` | 自检配置 / curl / 账号；`--fix` 自动修复 |
| `web update [--check]` | 更新 CLI 到最新发布版本 |
| `web provider {list\|models}` | 查看 provider |

全局 flag：`-f, --format json|markdown|text`、`--max-length <n>`（默认
50000，超长输出自动存为文件并打印路径）、`--timeout-ms <n>`（默认 30000）。
search/fetch 支持 `--provider <别名或厂商名>` 与 `--account <别名>` 锁定账号；
不指定时按分段的 provider 优先级顺序自动故障转移。

## 配置

活动配置为 `./.web/config.json`（项目作用域，存在即整体生效），否则使用
`~/.web/config.json`。密钥可写明文，也可写 `{$ENV_VAR}` 引用（从环境变量与
`.env` 文件解析）。

```json
{
  "runtime": { "lock_ttl_ms": 900000, "retry_rounds": 1 },
  "providers": { "tavily": { "enabled": false } },
  "search": {
    "providers": { "primary": "tavily", "list": ["brave", "perplexity"] },
    "account": {
      "tavily-main": { "provider": "tavily", "api_token": "{$TAVILY_API_KEY}" },
      "tavily-backup": { "provider": "tavily", "api_token": "tvly-…" }
    }
  },
  "fetch": { "account": {} }
}
```

- `providers.<name>.enabled: false` 全局关闭某个 provider；`web provider list`
  与 `web doctor` 会显示状态。
- `search.providers` / `fetch.providers` 设置回退顺序：`primary` 最先，其次
  `list`，最后其余 provider。
- `runtime.lock_ttl_ms`（默认 900000）是失败账号的冷却时长；
  `runtime.retry_rounds`（默认 1）是遍历全部账号的轮数。
- `web config use <group> <alias>` 把活动默认账号写入单独的 `current.json`。

## 故障转移（failover）如何工作

任何 provider 失败时，`web` 会记录失败原因，并把该账号**锁定 15 分钟**
（持久化到 `<活动目录>/.web/locks.json`，跨次调用生效），然后推进到下一个
账号。锁定中的账号会被跳过；当所有账号都被锁定时，按最早锁定的时间优先重试。
默认每次调用只完整走一遍队列，循环必然终止；全部失败时报 `*_ALL_FAILED`
（附各账号明细）。指定 `--provider`/`--account` 时绕过 lock 文件。

每次尝试都记录到 `~/.web/logs`（或 `./.web/logs`）。详见
[`docs/error-handling.md`](./docs/error-handling.md)。

## 插件

所有 provider 都是插件，契约唯一：`activate(host)` 调用
`host.registerFactory(name, factory)`。工厂可声明 `config` schema（例如多个
base URL 供选择），`web config add` 会按它渲染菜单，所选值平铺写入账号条目。
内置插件随包发布于 `src/web/plugins/builtin/`；外部 provider 以 CommonJS
模块形式放在 `~/.web/plugins/<id>/plugin.json`。详见
[`docs/plugin-protocol.md`](./docs/plugin-protocol.md)。

## 文档

- [`SPEC.md`](./SPEC.md) —— 完整权威规格
- [`docs/plugin-protocol.md`](./docs/plugin-protocol.md) —— 编写自己的 provider 插件
- [`docs/provider-apis.md`](./docs/provider-apis.md) —— 已验证的 provider 端点
- [`docs/error-handling.md`](./docs/error-handling.md) —— 故障分类、日志、自检

## License

MIT
