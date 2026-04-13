# Onboard：首次配置

## `web onboard`（交互）

在 **TTY 终端**运行，使用多选与密码提示，**只写入 `~/.web/`**（`config.toml`、`.env`、`README.md`、`README_CN.md`、`skills/web-cli/`），不会创建当前目录下的 `./.web`。

1. 若尚无有效 `~/.web/config.toml`，会从仓库 `init/` 复制模板。
2. 若已有配置：选择「在现有基础上调整」或「清空多选默认后重新勾选」。
3. 空格勾选 Search / Fetch / Answer 能力，回车确认（勾选 **Tavily** 或 **Perplexity** 的 Search 时，会按相同账号同步写入 `[research.account.*]`）。
4. 按提示输入各 `{$ENV}` 对应的密钥（可留空，稍后编辑 `~/.web/.env`）。
5. 确认后落盘。

非交互环境（CI、管道）请使用 `web onboard init`。

## `web onboard init`（无交互）

从 `init/config.toml` 与 `init/.env.example` 复制到 `~/.web`（其中环境变量模板写入 `~/.web/.env`）。若目标已存在且未传 `--force`，命令会退出并提示使用 `--force`。

传 `--force` 时：若已有 `~/.web/.env`，会先读其中**非空**键值，再覆盖为模板后把这些键写回（保留模板注释与键顺序；仅合并有值的变量）。

`web onboard init` 在**首次**初始化 `~/.web/` 时会写入 `README.md`（英文）与 `README_CN.md`（中文），内容为本地速查（多账号顺序、`--provider` / `--account`）；传 `--force` 时强制覆盖这两个文件及 `config.toml` / `.env` 模板。交互向导结束时若缺少其中任一文件，会调用 `writeWebHomeReadmeIfMissing` 补齐。完整手册见仓库根目录 `README.md` / `README_CN.md`。

会将 `init/skills/web-cli` 同步到 `~/.web/skills/web-cli`；若本机已存在 `~/.agent/skills`、`~/.claude/skills`、`~/.openclaw/skills`、`~/.codex/skills` 或 `~/.gemini/skills`，则在其下覆盖写入同名 `web-cli` 目录（不自动创建这些父目录）。

## 运行时配置分层

- 先加载 **`~/.web`**。
- 若当前工作目录存在 **`./.web/config.toml`**，与其 **深度合并**（项目里出现的 `account` 键与 `inject_before`、`inject_after` 等覆盖全局；未写的键沿用全局）。
- **`./.web/.env`** 若存在，在全局 `.env` 之上再合并（同名变量 **项目优先**）。
- 插件：`~/.web/plugins` 先加载，再加载 `./.web/plugins`（后者 **覆盖** 同名 provider 工厂注册）。

## runtime 配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `logging` | `true` | 是否启用文件日志（写入 `<cwd>/.web/logs/`） |

## PM 验收提示

- 全新机器：无 `~/.web` 时向导能自动 bootstrap。
- 已有配置：查看 `<cwd>/.web/logs/` 与 `web config list` 核对全局/项目合并结果。
- 仅项目覆写部分键：未覆写的项仍来自全局。
- `Ctrl+C`：依赖终端行为；建议在半写入前不要强制杀进程（向导在确认后才 `saveConfig`）。
