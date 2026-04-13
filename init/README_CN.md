[English](README.md)

# init 模板

`web onboard init` 会将本目录下的 `config.toml` 与 `.env.example` 复制到 `~/.web/`（密钥模板在目标机命名为 `.env`；可用 `--force` 覆盖已有文件）。运行时可再由项目目录的 `./.web/config.toml`、`.env` **深度合并**覆写全局。

## 多账号与同厂商 failover

在每个能力段（`[search]`、`[fetch]`、`[answer]`、`[research]`）下可写多条 `[*.account.账号id]`。**文件中声明顺序即运行时尝试顺序**：前一条失败会静默换下一个，直到成功或全部失败。

同一 `provider` 可配多条不同 `账号 id`（例如两个 Tavily key），实现密钥池轮换。

## CLI 与配置的关系

- `web search|fetch|answer|research … --provider <账号id或厂商名>`：缩小到单条账号，或到「该厂商」下按配置顺序的多条账号。
- `web … --account <账号id>`：固定只用这一条；可与 `--provider` 组合做厂商校验。
- `web search|answer|research … --providers a b` 为**多路并发**，**不可**与 `--account` 同用。
- `web answer` 的问题为**位置参数**（`web answer "问题"`），不是 `--query`。

更完整的说明见仓库根目录 [README.md](../README.md) / [中文 README_CN.md](../README_CN.md)。
