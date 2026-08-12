[English](README.md)

# init 模板与 skills

本目录随 npm 包一起发布，存放面向用户的模板：

- `config.json` —— `web config init` 写出的内置默认配置的模板镜像
  （运行时权威来源是 `src/web/config/defaults.ts`，两者需保持同步）。
- `.env.example` —— `~/.web/.env` 密钥文件模板。
- `skills/web-cli/` —— Agent 技能文档的**发布源**（SKILL.md + examples.md +
  troubleshooting.md）。仓库内的 `.claude/skills/web-cli/` 与用户机上的
  `~/.web/skills/web-cli/` 都必须与它保持一致。

## 配置模型

- `~/.web/config.json` 是全局配置；项目目录下的 `./.web/config.json` 会
  **deep-merge 覆写**全局。
- API token 可写明文，也可写 `{$ENV_VAR}` 引用；解析顺序：进程环境变量 ←
  `~/.web/.env` ← `./.web/.env`（后者覆盖前者）。
- 活动账号指针放在**单独的** `current.json`，用
  `web config use <group> <alias>` 管理 —— 不要为此改 `config.json`。

## 多账号 failover

每个能力组（`search`、`fetch`）各持有一个 `account` 映射。活动账号优先
尝试，其余按声明顺序；每次失败都会分类并记录日志，然后轮换到下一个。
同一 `provider` 配多条不同 key 即构成密钥池。

## CLI 与配置的关系

- `web search|fetch … --account <别名>`：固定只用这一条账号。
- `web search|fetch … --provider <厂商名或别名>`：锁定一个厂商或账号别名。
- `web search|fetch … --vendor k=v`：厂商原生参数（按 provider 白名单过滤）。

完整手册见仓库根目录 [README.md](../README.md) /
[README_CN.md](../README_CN.md)；权威需求见 `SPEC.md`。
