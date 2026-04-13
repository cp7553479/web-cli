# Web CLI Troubleshooting

## 1) 项目 `./.web` 与全局冲突

1. 检查该仓库下是否存在 `./.web/config.toml` 或 `./.web/.env`
2. `web config list` 核对生效配置与项目覆写路径
3. 查看 **`<cwd>/.web/logs/`** 中本次命令的请求/响应（`runtime.logging` 未关闭时）

## 2) `环境变量未设置: XXX`（`ENV_TOKEN_NOT_FOUND`）

1. 检查 `~/.web/config.toml` 的 `api_token` 与 `enabled`（未写 `enabled` 时视为启用）
2. 在 `~/.web/.env` 添加对应变量，或将暂不使用的 model 设为 `enabled = false`
3. `web config list` 确认模型存在

## 3) `未找到 provider 或 alias`

1. `web config list`
2. 校验 `group.account` 中账号 id / `provider` 字段
3. 更正 `--provider` / `--account` 或 `web config set`

## 4) 鉴权失败（401/403）

1. token 与厂商是否匹配、是否过期
2. 用仓库 `docs/provider-curl-mapping.md` 做最小 curl 验证

## 5) 超时或网络失败

1. 增大 `--timeout-ms`
2. 换 `--provider` / `--account` 或调整 `[fetch.account.*]` 顺序

## 6) fetch 结果为空或异常

1. 静态页试 `provider = "http"` 的账号
2. 动态页试 `provider = "playwright"` 与 `--wait-until networkidle`
3. `--selector` 缩小 DOM 范围

## 7) 日志里看什么

`<cwd>/.web/logs/*.log` 含 `http.request` / `http.response` 与用户指令。关闭日志：`config.toml` 里 `[runtime] logging = false`。

## 8) 仓库内跑 `npm test`

集成测在**仓库根**启动 CLI，配置与密钥来自 **`~/.web` 与 `./.web` 合并**；密钥放在 `./.web/.env` 或 `~/.web/.env`，勿提交。外网烟测：`WEB_RUN_JINA_SMOKE=1`（Jina search）、`WEB_RUN_FETCH_HTTP_SMOKE=1`（http fetch）。
