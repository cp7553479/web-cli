[English](README.md)

# Web CLI 使用手册

一条命令搞定「搜网页、抓内容、查资料、问答」。

你只需要配一次 `~/.web`，以后在任何目录执行 `web search …` / `web fetch …` / `web answer …` / `web research …`，一个 `web` CLI 统一对接各厂商**官方 HTTP API**（无「search 再 fetch 拼成 research」的本地编排）。

---

## 目录

- [为什么需要这个工具](#为什么需要这个工具)
- [能做什么（功能总览）](#能做什么功能总览)
- [安装](#安装)
- [首次配置](#首次配置)
- [配置怎么写](#配置怎么写)
- [所有命令通用的选项](#所有命令通用的选项)
- [命令详解](#命令详解)
  - `[web search` — 搜网页](#web-search--搜网页)
  - `[web fetch` — 抓网页内容](#web-fetch--抓网页内容)
  - `[web research` — 官方深度研究 API](#web-research--官方深度研究-api)
  - `[web answer` — 直接给答案](#web-answer--直接给答案)
  - `[web config` — 管理配置](#web-config--管理配置)
  - `[web onboard` — 首次配置向导](#web-onboard--首次配置向导)
  - `[web plugins` — 查看已装的插件](#web-plugins--查看已装的插件)
- [多源并发搜索](#多源并发搜索)
- [输出格式](#输出格式)
- [日志记录](#日志记录)
- [Inject Prompt（注入提示文字）](#inject-prompt注入提示文字)
- [出问题了怎么排查](#出问题了怎么排查)
- [内置支持的服务商](#内置支持的服务商)
- [更多文档](#更多文档)

---

## 为什么需要这个工具

假设你用过 AI Agent（比如 Claude、Cursor Agent 等），它们「搜网页」「抓网页」靠的是 Tavily、Brave、Jina 这类第三方服务。

问题是：

- **每个 Agent 各自接一家**——你在 A 工具里配了 Tavily 密钥，到 B 工具又得重新配一遍。
- **某家 API 挂了或额度用完**，没有备选，直接失败。

这个 CLI 就是来解决这个问题的：

1. **配一次，到处用**。把你的 API 密钥统一放在 `~/.web/` 目录，所有工具共享。
2. **可以配多家**。比如搜索同时配 Jina 和 Tavily，第一家失败会自动试下一家。
3. **密钥不写进配置文件**。配置文件里只写一个占位符 `{$TAVILY_API_KEY}`，真正的密钥放在单独的 `.env` 文件里，安全、方便。

---

## 能做什么（功能总览）


| 你想做什么        | 命令                                 | 一句话说明                                                                      |
| ------------ | ---------------------------------- | -------------------------------------------------------------------------- |
| 搜网页          | `web search "关键词"`                 | 像用搜索引擎一样，返回标题、链接、摘要。                                                       |
| 抓某个网页的内容     | `web fetch https://…`              | 给一个或多个网址，把正文拉回来。                                                           |
| 深度研究（官方 API） | `web research "问题"`                | 调用厂商 **research** 端点（如 Tavily `/research`、Perplexity Sonar deep research）。 |
| 问一个问题，直接要答案  | `web answer "问题"`                  | 调 DuckDuckGo / Brave / Gemini 等即时问答接口。                                     |
| 同时用多家搜索      | `web search "关键词" --providers a b` | 并发请求多个搜索源，合并所有结果一起返回。                                                      |
| 看 / 改我的配置    | `web config …`                     | 查看当前配置、增删服务商、调整优先级。                                                        |
| 第一次初始化       | `web onboard …`                    | 帮你创建 `~/.web/` 目录和模板文件。                                                    |
| 看装了哪些插件      | `web plugins list`                 | 列出额外安装的插件。                                                                 |


**自动容错**：搜索、抓取、问答、研究，都会按你配的顺序 **逐个试**。前一个服务挂了，自动换下一个，全挂才报错。中间的失败不会输出到屏幕，只记录在日志里。

### 四能力是什么（与厂商接口一一对应）


| 能力           | 含义                         | CLI            |
| ------------ | -------------------------- | -------------- |
| **search**   | 联网搜索，返回适合 LLM 的检索结果        | `web search`   |
| **fetch**    | 返回适合 LLM 的网页正文 / 抽取内容      | `web fetch`    |
| **answer**   | 厂商侧基于检索与网页、经 LLM 整理后的回答    | `web answer`   |
| **research** | 比 answer 更深、厂商提供的「研究」类 API | `web research` |


扩展请求参数通过 `--vendor key=value`（可重复）传入；在 `search` / `answer` / `research` 上也可直接写未注册的 `--键名 值` 或 `--键名=值`（与 `--vendor` 合并，**同名键以 `--vendor` 为准**），**仅各厂商文档允许的白名单键**会进入 HTTP 请求体，其余静默忽略。统一 CLI 名：`--country`、`--site` / `--sites`、`--safesearch`（search）；厂商不支持对应字段时同样静默忽略。

**多 `--providers`**：仍是多次**独立**官方 API 调用，再在客户端合并结果（与单端点语义不同，见 [多源并发搜索](#多源并发搜索)）。

---

## 安装

```bash
git clone <本仓库地址>
cd web
npm install
npm run build
```

装完后让系统认识 `web` 命令：

```bash
npm link
```

这会把 `web` 注册为全局命令，之后在任何目录都能直接敲 `web …`。

试一下装好了没有：

```bash
web --help           # 看总帮助
web search --help    # 看 search 的帮助
```

---

## 首次配置

安装好 CLI 后，需要初始化一个配置目录 `~/.web/`（在你的用户主目录下，比如 `/Users/你的名字/.web/`）。

**最快的方式——一键复制模板**：

```bash
web onboard init
```

这会把仓库里 `init/config.toml` 与 `init/.env.example` 复制到 `~/.web/`（环境变量文件落盘为 `~/.web/.env`）。

然后：

1. 打开 `~/.web/.env`，把你有的 API 密钥填进去。默认模板启用了 Jina 的 search 与 fetch，**至少需要**填写 `JINA_API_KEY`（申请地址见 `init/config.toml` 或 `init/.env.example` 顶部列表）；其他厂商按需填写。
2. 打开 `~/.web/config.toml`，按需取消注释模板里的 `[*.account.*]` 段。不写 `enabled` 时默认为**启用**；只有需要关闭某条账号时才写 `enabled = false`。

**如果你更喜欢交互式一步步选**：

```bash
web onboard
```

会弹出一个选择界面，让你勾选想用哪些服务、填密钥，最后帮你写好文件。（需要在终端里跑，不能在脚本或自动化流程里用。）

**如果已经配过，想重新来**：

```bash
web onboard init --force
```

---

## 配置怎么写

### 配置文件放在哪


| 文件位置                 | 说明                                         |
| -------------------- | ------------------------------------------ |
| `~/.web/config.toml` | **主配置**：写清楚你用哪些搜索/抓取/问答服务、先试谁后试谁。          |
| `~/.web/.env`        | **密钥文件**：你的 API Key 都放这里，不要写进 config.toml。 |


还有一个可选的「项目级配置」——如果某个项目想用不同的设置：


| 文件位置                 | 说明                                         |
| -------------------- | ------------------------------------------ |
| `./.web/config.toml` | 放在项目根目录的 `.web/` 下。这里写的会 **覆盖** 全局配置里的同名项。 |
| `./.web/.env`        | 同上，项目密钥覆盖全局密钥。                             |


仓库内 `**npm test`** 的集成用例在**仓库根目录**启动 CLI，与上述「项目级 `./.web`」一致；本机需已配置可用的 `~/.web`（及按需的 `./.web`）。外网烟测需显式开启：`**WEB_RUN_JINA_SMOKE=1`**（Jina search）、`**WEB_RUN_FETCH_HTTP_SMOKE=1`**（http fetch），否则对应用例跳过。

> 想看模板文件的逐行解释，请直接打开仓库里的 `init/config.toml` 和 `init/.env.example`，里面有非常详细的中文注释。

### config.toml 的基本结构

config.toml 分成四大块，对应四种能力：

```toml
[search]          # 搜索能力
[fetch]           # 抓取能力
[research]        # 深度研究（仅走各厂商官方 research API；配置 [research.account.*]）
[answer]          # 即时问答能力
[runtime]         # 运行期开关
```

每个能力下面主要是 `**[group.account.账号id]**` 一段段配置。

- `**账号 id**`（表头最后一段，例如 `[search.account.perplexity-main]` 里的 `perplexity-main`）是本工具内部的标识，用来区分多条配置；你可以自定义命名。
- **同一厂商多账号**：可写多行相同 `provider`、不同 `账号 id`（例如两个 Tavily key），按文件中声明顺序依次尝试，实现自动切换。
- **尝试顺序**：在文件里谁先出现，谁就先试；前一个失败（出错、超时等）再试下一个，直到成功或全部试完。
- **CLI**：`--provider <厂商名或账号id>` 可把尝试范围缩到该厂商（按上面顺序在**同厂商**账号间 failover），或直指某条账号 id。`--account <账号id>` 固定只用这一条；若与 `--provider` 同用，会校验该账号是否属于该厂商。`--providers`（多路并发）不能与 `--account` 同用。

`provider` 字段填**厂商名**（如 `jina`、`kimi`、`brave`），CLI 根据当前命令上下文（`web search` / `web fetch` / `web answer` / `web research`）自动选用该厂商**已实现**的子组件。同一个厂商可以同时出现在 search、fetch、answer、research 等不同能力段里；若某厂商未实现该段能力，对应 account 在 materialize 时不会注册，failover 时会跳过。

举个完整例子：

```toml
[search]

# Jina Search：需要 JINA_API_KEY（申请见 init/config.toml 顶部链接）
[search.account.jina-main]
provider = "jina"
api_token = "{$JINA_API_KEY}"
enabled = true

# Tavily：需要 TAVILY_API_KEY（写在后面，作为备选）
[search.account.tavily-main]
provider = "tavily"
api_token = "{$TAVILY_API_KEY}"
enabled = false
```

想改优先级时：**在编辑器里整块移动** `[search.account.xxx]` 的位置即可，不用单独维护别的字段。

### 密钥占位符 `{$XXX}` 是怎么回事

配置里写 `api_token = "{$TAVILY_API_KEY}"` 意思是：**启动时去找一个叫 `TAVILY_API_KEY` 的环境变量，用它的值替换这里**。

程序会按这个顺序找：

1. 系统已有的环境变量（`export TAVILY_API_KEY=xxx` 那种）
2. `~/.web/.env` 文件里写的
3. `./.web/.env`（项目级，如果有的话，会覆盖上面的）

**重要**：除 `enabled = false` 的账号外，其余（不写 `enabled` 或写 `true`）都会解析 `{$VAR}` 占位符并要求对应环境变量非空。`enabled = false` 时占位符不会被解析，密钥可以不填。

### 关于 `[research]` 这个段

`web research` **只读** `[research.account.*]`。请为 **提供官方 research API** 的厂商配置账号（当前内置：**tavily**、**perplexity**）。不要把仅支持 search 的厂商写在本段，否则会提示无可用的 research 注册。

---

## 所有命令通用的选项

这些选项放在 `web` 和子命令之间。比如：

```bash
web --timeout-ms 30000 search "query"
#    ^^^^^^^^^^^^^^^^^^
#    全局选项              search 是子命令
```


| 选项                  | 默认值     | 干什么用的                                                                 |
| ------------------- | ------- | --------------------------------------------------------------------- |
| `-f, --format <格式>` | `text`  | 输出格式。可选 `text`（给人看）、`json`（给程序解析）、`markdown`（适合粘贴到文档）。                |
| `--max-length <数字>` | `10000` | 输出最多多少个字符。超出会截断，末尾提示 `[truncated]`。                                   |
| `--timeout-ms <毫秒>` | `15000` | 每次请求最多等多久。默认 15 秒。如果网络慢或者抓取大页面，可以调大。                                  |
| （无 stderr 调试开关）     | —       | 请求/响应与指令在 `**runtime.logging` 未关闭** 时写入 `**<当前目录>/.web/logs/*.log`**。 |


---

## 命令详解

### `web search` — 搜网页

```bash
web search "你想搜的内容"
```

就像用搜索引擎：输入关键词，返回标题、链接、摘要。


| 选项                            | 说明                                                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| `--site github.com npmjs.com` | 只搜这几个网站（可以写多个，空格分隔）。                                                    |
| `--sites …`                   | 与 `--site` 相同语义，可多组。                                                    |
| `--country US`                | 统一参数：国家/地区（厂商支持则映射，否则忽略）。                                               |
| `--countries US CA`           | 多值国家；实现上拼为单一字符串写入 `country`（厂商不支持则忽略）。                                  |
| `--safesearch strict`         | 统一参数：安全搜索（厂商支持则映射，否则忽略）。                                                |
| `--vendor k=v`                | 厂商原生参数，可重复；仅白名单键写入请求体。                                                  |
| `--include_answer true` 等     | 未在 Commander 注册的 `--官方字段名` 会并入 vendor 参数（同白名单过滤）；与 `--vendor` 同名时以后者为准。 |
| `--limit 10`                  | 最多返回几条结果，默认 5。                                                          |
| `--freshness day`             | 只要最近的内容。可选 `day`（一天内）、`week`、`month`、`year`。不是所有服务都支持。                  |
| `--language zh`               | 按语言过滤（不是所有服务都支持）。                                                       |
| `--region CN`                 | 按地区过滤（不是所有服务都支持）。                                                       |
| `--provider xxx`              | 指定用哪个服务（账号 id 或厂商名）。不写就按配置顺序来。                                          |
| `--account xxx`               | 固定只用该账号 id；可与 `--provider` 组合做厂商校验。不可与 `--providers` 同用。                |
| `--providers a b c`           | 同时用多个服务并发搜索，合并返回结果。详见 [多源并发搜索](#多源并发搜索)。                                |


示例：

```bash
# 搜 Node.js CLI 框架，只看 GitHub 和 npm，要 8 条
web search "nodejs cli framework" --site github.com npmjs.com --limit 8

# 用 Tavily 搜，输出 Markdown 格式
web search "AI 搜索 API" --provider tavily-main -f markdown

# 固定使用某条账号（可与 --provider 一起校验厂商）
web search "AI 搜索 API" --provider kimi --account kimi-main

# 同时用 Jina 和 Tavily 搜，合并结果
web search "AI news 2026" --providers jina-main tavily-main

# 出问题了？看当前目录下 .web/logs/ 里的日志文件
web search "test query"
```

---

### `web fetch` — 抓网页内容

```bash
web fetch https://example.com
```

给一个或多个网址，把网页正文内容拉回来。


| 你加的选项            | 会怎么抓                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| 什么都不加            | **默认**：按 `[fetch.account.*]` 声明顺序依次尝试各条 fetch 账号（含 `html2markdown`、`http`、`playwright` 等，取决于你的配置）。 |
| `--provider xxx` | 指定账号 id，或厂商名（则在该厂商的多条账号中按声明顺序依次尝试）。                                                                |
| `--account xxx`  | 固定只用该账号 id；可与 `--provider` 一起校验厂商。                                                                 |



| 选项                         | 说明                                                                  |
| -------------------------- | ------------------------------------------------------------------- |
| `--wait-until load`        | 厂商 `playwright` 时：等到 `load`（默认）、`domcontentloaded` 或 `networkidle`。 |
| `--provider xxx`           | 指定账号 id 或厂商名。                                                       |
| `--account xxx`            | 指定账号 id。                                                            |
| `--selector "div.article"` | 只提取页面中匹配该 CSS 选择器的部分（Playwright 等模式下生效）。                            |


**html2markdown**：默认模板里通常靠前。内置 HTML→Markdown 转换引擎，无需密钥。

**结果过长时**：如果抓取结果超过 100,000 字符，CLI 会自动把完整结果保存到 `.web/temp/` 目录下的 `.md` 文件，终端只输出文件路径提示。

示例：

```bash
# 默认：按 [fetch.account.*] 顺序尝试
web fetch https://example.com

# 用 Jina Reader 服务抓两个网址，输出 Markdown
web fetch https://a.com https://b.com --provider jina-reader -f markdown

# 用浏览器抓（适合 JS 渲染的页面），等到网络空闲
web fetch https://news.ycombinator.com --provider playwright --wait-until networkidle

# 用 html2markdown 提取文章正文
web fetch https://example.com/article --provider html2markdown-main
```

---

### `web research` — 官方深度研究 API

```bash
web research "你想研究的问题"
```

直接调用 `[research.account.*]` 链上各账号对应厂商的 **research** HTTP 端点（例如 Tavily `POST /research` 后轮询 `GET /research/{request_id}`；Perplexity `POST /chat/completions` 且默认 `sonar-deep-research` 模型）。


| 选项                    | 说明                                                                              |
| --------------------- | ------------------------------------------------------------------------------- |
| `--max-sources 6`     | 传给厂商请求的 `limit` 提示（语义因厂商而异），默认 5。                                               |
| `--vendor k=v`        | 通用扩展参数（可重复），`k` 为官方 body/query 字段名；仅各厂商白名单内的键会下发（如 `--vendor model=sonar-pro`）。 |
| `--model sonar-pro` 等 | 未注册长选项并入 vendor 参数；与 `--vendor` 同名键以 `--vendor` 为准。                             |
| `--provider xxx`      | `[research.account.*]` 中的账号 id 或厂商名。                                            |
| `--account xxx`       | 固定某条 research 账号 id；不可与 `--providers` 同用。                                       |
| `--providers a b c`   | 多个 research 账号/厂商并发调用，客户端合并。见 [多源并发搜索](#多源并发搜索)。                                |


示例：

```bash
# Tavily research（需在 [research.account.*] 配置 tavily）
web research "2026 Node.js CLI best practices" --max-sources 6 -f markdown

# 多账号并发（均为已注册的 research provider）
web research "AI agent frameworks 2026" --providers tavily-main perplexity-main
```

---

### `web answer` — 直接给答案

```bash
web answer "你的问题"
```

不是搜索——是直接调各厂商 **answer** 端点：DuckDuckGo Instant Answer、Brave Answers、Gemini Grounding、Perplexity Sonar（`chat/completions`）、Tavily（Search + `include_answer`）、Firecrawl Interact（需 `--url`）等。


| 选项                  | 说明                                               |
| ------------------- | ------------------------------------------------ |
| `<query>`           | **位置参数**，问题全文。                                   |
| `--url <url>`       | **Firecrawl interact 必填**：先 scrape 的页面 URL。      |
| `--vendor k=v`      | 通用扩展参数（可重复）；如 `--vendor model=sonar-pro`。        |
| `--model …` 等       | 未注册长选项并入 vendor；与 `--vendor` 同名键以 `--vendor` 为准。 |
| `--provider xxx`    | 用哪个问答服务（账号 id 或厂商名）。                             |
| `--account xxx`     | 固定某条账号 id；不可与 `--providers` 同用。                  |
| `--providers a b c` | 同时用多个问答服务并发查询。详见 [多源并发搜索](#多源并发搜索)。              |
| `--no-redirect`     | 给 DuckDuckGo 用的：不要跳转。                            |
| `--no-html`         | 给 DuckDuckGo 用的：去掉 HTML 标签。                      |
| `--skip-disambig`   | 给 DuckDuckGo 用的：跳过歧义消解。                          |


示例：

```bash
web answer "What is Rust?"
web answer "今日新闻摘要" --provider gemini-main -f json

# 同时向 DuckDuckGo 和 Brave 问，合并结果
web answer "AI trends" --providers ddg-main brave-answer

# Firecrawl：先打开页面再下指令（官方 scrape → interact）
web answer "提取首屏价格" --provider firecrawl-scrape --url https://example.com
```

---

### `web config` — 管理配置

用命令行读写 `~/.web/config.toml`，不用手动编辑文件。（当然你手动编辑也完全可以。）


| 命令                                           | 干什么                          |
| -------------------------------------------- | ---------------------------- |
| `web config list`                            | 看一下当前的完整配置（密钥会被打码显示，不用担心泄露）。 |
| `web config set <组> <账号id> --provider <厂商名>` | 添加或修改一条 account。             |
| `web config remove-model <组> <账号id>`         | 删掉一条 account。                |


这里的 `<组>` 就是 `search`、`fetch`、`research`、`answer` 四选一。

`set` 命令的选项：


| 选项                     | 说明                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--provider <厂商名>`     | **必填**。比如 `tavily`、`brave`、`jina`、`kimi`、`firecrawl`、`perplexity`、`gemini`、`duckduckgo`、`http`、`html2markdown`、`playwright`。 |
| `--token <密钥>`         | API 密钥。可以直接写明文，也可以写占位符 `'{$TAVILY_API_KEY}'`（推荐）。                                                                            |
| `--base-url <地址>`      | 如果这个服务你要连私有部署或其他地址，可以写在这里。一般不用填。                                                                                             |
| `--enabled true/false` | 是否启用，默认 `true`。                                                                                                              |


示例：

```bash
# 看当前配置
web config list

# 加一个 Tavily 搜索服务
web config set search tavily-main --provider tavily --token '{$TAVILY_API_KEY}'

# 调整谁先谁后：直接编辑 ~/.web/config.toml，移动各 [search.account.*] 整块顺序

# 删掉不用的
web config remove-model search old-alias
```

---

### `web onboard` — 首次配置向导


| 命令                         | 说明                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `web onboard init`         | 把模板文件复制到 `~/.web/`。最简单直接，适合所有人。                                                                 |
| `web onboard init --force` | 强制覆盖 `config.toml` / `.env`；`.env` 会先合并已有非空键再写回；并刷新 `~/.web/README.md` 与 `~/.web/README_CN.md`。 |
| `web onboard`              | 打开交互式向导，一步步选服务、填密钥。（需要在终端里跑。）                                                                   |


---

### `web plugins` — 查看已装的插件

```bash
web plugins list
```

列出 `~/.web/plugins/` 下安装的外部插件。

**普通用户不需要关心这个。** 内置的服务商（Brave、Tavily、Jina 等等）已经够用了，不需要装任何插件。这个功能是给想接入自己私有搜索服务的人准备的。

---

## 多源并发搜索

`--providers` 是 `search`、`answer`、`research` 三个命令共有的能力。和 `--provider`（单数）的区别：


|      | `--provider xxx`                | `--providers a b c`                    |
| ---- | ------------------------------- | -------------------------------------- |
| 行为   | 只用 `xxx` 这一个服务。如果失败，按配置顺序尝试下一个。 | 同时向 `a`、`b`、`c` 发起请求（并发），把所有成功的结果合并返回。 |
| 适合场景 | 你确定用哪家，或者想指定优先的那家。              | 想要多家结果综合比较，比如同时看 Jina 和 Tavily 搜出来的东西。 |


`**--account`** 只能与单路模式（`--provider` 或不指定并发）一起用；与 `--providers` **互斥**。

`--providers` 后面跟的名字可以是：

- **账号 id**（`config.toml` 里 `[search.account.这里]` 的名字），比如 `jina-main`、`tavily-main`。
- **厂商名**（比如 `tavily`、`jina`），会自动找到对应的别名。

**如果名字写错了**，CLI 会提示你可以用哪些：

```
Unsupported provider 'xxx'. Available for search: jina-main, tavily-main, brave-main, jina, tavily, brave
```

示例：

```bash
# 搜索：同时用 Jina 和 Tavily
web search "latest AI papers" --providers jina-main tavily-main

# 问答：同时向 DuckDuckGo 和 Brave 问
web answer "什么是量子计算" --providers ddg-main brave-answer

# 深度研究：搜索阶段用多个源
web research "2026 前端框架趋势" --providers jina-main tavily-main --max-sources 8
```

---

## 输出格式

通过 `-f` 选项控制：


| 格式         | 适合谁            | 长什么样                |
| ---------- | -------------- | ------------------- |
| `text`     | 人在终端看          | 编号列表，每条有标题、链接、摘要。   |
| `markdown` | 复制到文档 / 笔记     | 用 Markdown 标题和列表排版。 |
| `json`     | 给程序 / Agent 解析 | 标准 JSON 格式。         |


```bash
web search "hello" -f json
web search "hello" -f markdown
web search "hello"              # 默认 text
```

---

## 日志记录

默认开启，日志写入 `<当前目录>/.web/logs/` 目录，文件名格式 `YYYY-MM-DD-<id>.log`。日志记录用户指令、API 请求和响应。

关闭方法：在 `~/.web/config.toml` 的 `[runtime]` 段设 `logging = false`。

---

## Inject Prompt（注入提示文字）

可以为每个能力段配置 `inject_before` / `inject_after`，在输出结果的前面和后面注入一段文字。适合给 AI Agent 加上下文提示。

```toml
[search]
inject_before = "The following results are from Internet searches, for reference only and may not be authentic:"
inject_after = ""
```

每个能力段（search / fetch / research / answer）可以分别设置。

---

## 出问题了怎么排查

### 第一步：看日志目录

命令不会在终端打印调试流水。开启 `runtime.logging`（默认）时，打开 `**<当前目录>/.web/logs/**` 下对应日期的 `.log` 文件，里面有请求、响应与报错栈。

### 第二步：看日志文件

日志默认写在 `<当前目录>/.web/logs/` 下，里面有完整的请求和响应记录。

### 常见错误


| 报错                                                                     | 原因                                                            | 怎么办                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `环境变量未设置: TAVILY_API_KEY`                                              | 你在 config 里启用了 Tavily（未写 `enabled` 或 `enabled = true`），但 `~/.web/.env` 里没填密钥。 | 去 `~/.web/.env` 填上密钥；如果暂时不想用这个服务，把 config 里对应的 `enabled` 改成 `false` 就行。                 |
| `search: all configured accounts failed…`                              | 搜索链上全部失败或账号未注册 search。                                        | 查看 `<cwd>/.web/logs/`；核对 `[search.account.*]` 与密钥。                                      |
| `research: no accounts configured…`                                    | `[research.account.*]` 为空。                                    | 添加 tavily / perplexity 的 research 账号。                                                   |
| `research: configured account(s) use provider(s) that do not support…` | research 段里全是 jina/brave 等无官方 research 的厂商。                   | 改为 `provider = "tavily"` 或 `perplexity`。                                                |
| `Unsupported provider 'xxx'. Available for …`                          | `--provider` 或 `--providers` 里写了一个不存在的名字。                     | 按提示信息里列出的可用名字修改即可。                                                                      |
| `All fetch providers failed`                                           | `[fetch.account.*]` 链上全部失败。                                   | 查看 `<cwd>/.web/logs/`；调整 `[fetch.account.*]` 顺序或增删账号；用 `--provider` / `--account` 收窄排查。 |


---

## 内置支持的服务商

配置里的 `provider = "xxx"` 填厂商名，CLI 根据能力段上下文自动选用对应组件。


| 厂商名             | 服务商                 | 支持的能力                                                                                                                                                                                                                                                                                                          | 官方文档（入口）                         |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `jina`          | Jina                | search、[Reader fetch](https://r.jina.ai/docs)                                                                                                                                                                                                                                                                  | [Search](https://s.jina.ai/docs) |
| `tavily`        | Tavily              | search（含 `[include_answer](https://docs.tavily.com/documentation/api-reference/endpoint/search)`）、[extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract) fetch、[research](https://docs.tavily.com/documentation/api-reference/endpoint/research)、answer（与 search 同源 `include_answer`） | 需 `TAVILY_API_KEY`               |
| `brave`         | Brave               | [Web search](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)、[Answers](https://api-dashboard.search.brave.com/documentation/services/answers)                                                                                                                                 | 需 `BRAVE_API_TOKEN`              |
| `kimi`          | Kimi / Moonshot     | search（[web_search / tools](https://platform.kimi.com/docs/guide/use-web-search)）、fetch（formula）                                                                                                                                                                                                               | 需 `MOONSHOT_API_KEY`             |
| `firecrawl`     | Firecrawl           | [search](https://docs.firecrawl.dev/features/search)、[scrape](https://docs.firecrawl.dev/features/scrape) fetch、[interact](https://docs.firecrawl.dev/features/interact) answer（需 `--url`）                                                                                                                     | 需 `FIRECRAWL_API_KEY`            |
| `perplexity`    | Perplexity          | [Search API](https://docs.perplexity.ai/docs/search/quickstart)、[Sonar answer](https://docs.perplexity.ai/docs/sonar/pro-search/quickstart)、[Sonar research](https://docs.perplexity.ai/docs/sonar/quickstart)                                                                                                 | 需 `PERPLEXITY_API_KEY`           |
| `html2markdown` | 内置 HTML→Markdown 引擎 | fetch                                                                                                                                                                                                                                                                                                          | 无                                |
| `http`          | 直连 HTTP GET         | fetch                                                                                                                                                                                                                                                                                                          | 无                                |
| `playwright`    | 无头 Chromium 抓取      | fetch                                                                                                                                                                                                                                                                                                          | 无                                |
| `duckduckgo`    | DuckDuckGo 即时回答     | answer                                                                                                                                                                                                                                                                                                         | 无                                |
| `gemini`        | Gemini + Google 搜索  | answer                                                                                                                                                                                                                                                                                                         | 需 `GEMINI_API_KEY`               |


各厂商密钥申请地址也可直接打开仓库里的 `init/config.toml` 或 `init/.env.example` 顶部说明。

想看每个服务底层发的是什么 HTTP 请求（curl 示例），见 `[docs/provider-curl-mapping.md](docs/provider-curl-mapping.md)`——普通使用不需要看。

---

## 更多文档

普通用户看上面的内容就够了。下面这些是给想深入了解或参与开发的人准备的：


| 文档                                                                   | 谁需要看       | 内容                         |
| -------------------------------------------------------------------- | ---------- | -------------------------- |
| `[docs/onboard.md](docs/onboard.md)`                                 | 想了解配置合并细节  | 首次配置的完整流程，全局配置和项目配置怎么合并。   |
| `[docs/provider-curl-mapping.md](docs/provider-curl-mapping.md)`     | 想知道底层请求长啥样 | 每个服务商对应的原始 curl 命令，方便自己调试。 |
| `[docs/plugin-protocol.md](docs/plugin-protocol.md)`                 | 想写自己的插件    | 插件目录结构和接入约定。               |
| `[CLAUDE.md](CLAUDE.md)`                                             | 参与开发的人     | 代码规范和开发约束。                 |
| `[SOUL.md](SOUL.md)`                                                 | 想了解设计思路    | 项目设计理念。                    |
| `[.claude/skills/web-cli/SKILL.md](.claude/skills/web-cli/SKILL.md)` | AI Agent   | Agent 怎么调用这个 CLI。          |


---

## 我为什么做这个项目

每个 AI Agent 框架都需要「搜索」和「抓取」能力，但每个框架各自接各自的，密钥配置散落各处，A 工具配一遍 B 工具又配一遍。

这个项目的想法很简单：**把所有搜索/抓取/问答服务统一收到一条 `web` 命令里**。配一次，到处用。挂一家，自动换。