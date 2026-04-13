---
name: web-cli
description: Use the `web` CLI for search, fetch, research, and answer with unified ~/.web config and multi-account failover.
---

# Web CLI（Agent 速查）

## 何时用

需要联网检索、抓正文、先搜后抓汇总、或即时问答时，**优先走 `web`**，不要散落调用各厂商 HTTP。

## 硬规则

1. 先确认配置：`web config list`
2. 用 **account id**（如 `kimi-main`）或 `--provider <厂商名>`，**禁止**在命令里写 token
3. `--providers`（多路并发）与 `--account` **互斥**

## 配置

- 全局：`~/.web/config.toml` + `~/.web/.env`（由 `init/.env.example` 经 `web onboard init` 生成）
- 项目覆写：`./.web/config.toml` / `./.web/.env` 与全局深度合并
- 同组 `[group.account.*]` **声明顺序 = 尝试顺序**；`--provider <厂商名>` 时只在该厂商的多条账号间按此顺序 failover

## 命令

```bash
web search "<q>" [--provider <alias|vendor>] [--account <id>] [--providers a b ...]
web fetch <url...> [--provider <alias|vendor>] [--account <id>]
web research "<q>" [--max-sources N] [--provider ...] [--account ...] [--providers ...]
web answer "<q>" [--provider ...] [--account ...] [--providers ...]
web config list
web onboard init              # 模板 + skills 写入 ~/.web
web onboard init --force      # 覆盖 config；.env 会合并旧文件非空键
```

全局输出与超时：`-f json|markdown|text`、`--max-length`、`--timeout-ms`（写在 `web` 与子命令之间）。

## 可观测性

无 `--verbose`。请求/响应与 CLI 指令在 **`runtime.logging` 未关闭** 时写入 **`<cwd>/.web/logs/*.log`**。失败时先看该日志与 `web config list`。

## 参考

同目录 `examples.md`、`troubleshooting.md`；仓库内完整手册见根目录 `README.md`、`docs/onboard.md`。
