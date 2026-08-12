# Web CLI Troubleshooting

## 1) 项目 `./.web` 与全局冲突

1. `web config path` 查看生效的 globalConfig / projectRoot / logsDir
2. 项目目录下 `./.web/config.json` 会 **deep-merge 覆写** `~/.web/config.json`；`./.web/.env` 同理覆盖 `~/.web/.env`
3. 查看 **`./.web/logs/`**（存在项目配置时）或 `~/.web/logs/` 中本次命令的请求/响应

## 2) `Environment variable 'XXX' is not set`（`ENV_TOKEN_NOT_FOUND`）

1. `api_token` 写的是 `{$XXX}` 引用但环境里没这个变量
2. 在 `~/.web/.env`（或项目 `./.web/.env`）添加 `XXX=...`，或把暂不用的账号设为 `--enabled false`
3. `web config doctor` 逐账号验证 `{$ENV}` 是否能解析

## 3) `Account 'xxx' not found` / 找不到 provider

1. `web config list` 核对别名与 provider 字段（token 已掩码）
2. `web provider list` 核对内置 provider id 与 aliases
3. 更正 `--account` / `--provider`，或 `web config set` 补建账号

## 4) 鉴权失败（401/403/422）

1. token 与厂商是否匹配、是否过期（注意：Brave 无效 token 返回的是 **422**）
2. 用仓库 `docs/provider-apis.md` 里的官方 curl 命令做最小验证

## 5) 欠费 / 配额（402/432）

1. 厂商返回 402（余额不足）或 432（Tavily 计划用量超限）→ 充值或升级
2. 欠费不影响其它账号：池会**自动轮换**到下一个账号；`web config use` 可把可用账号提到首位

## 6) `SEARCH_ALL_FAILED` / `FETCH_ALL_FAILED`

1. 错误输出的 `attempts[]` 里有每个账号的 classification 与原始报错，逐个排查
2. 常见组合：key 全失效 / 全部欠费 / 网络不通

## 7) 超时或网络失败

1. 增大 `--timeout-ms`
2. 换 `--account` / `--provider` 重试

## 8) fetch 结果为空或异常

1. 静态页：换 `provider = "http"`（原始 HTML）或 `html2markdown`（本地转 Markdown）账号
2. 动态页：`provider = "playwright"` 账号 + `--wait-until networkidle`
3. `--selector` 缩小 DOM 范围

## 9) fetch 输出被落盘

输出超过 100k 字符时不打印，自动保存到 `.web/temp/<时间戳>.md`，按提示读文件即可。

## 10) 日志里看什么

`~/.web/logs/*.log`（或项目级 `./.web/logs/`）含 `pool.attempt` / `http.request` / `http.response` 与用户指令；`runtime.logging` 默认开启，关闭：`config.json` 里 `"runtime": { "logging": false }`。

## 11) 仓库内跑 `npm test`

集成测对 `dist/index.js` 起子进程、用隔离 HOME，不依赖真实 `~/.web`。外网烟测默认跳过，显式开启：`WEB_RUN_FETCH_HTTP_SMOKE=1`。
