# CLAUDE.md

本文件定义 Claude Code 在本仓库的工作规则。

## 目标

围绕 `web` CLI 持续建设统一的 Web 能力层，让后续 Agent/开发者能稳定复用。

## 硬性规则

1. 仅使用官方 API 文档支持的 provider 或官方公开端点
2. 优先 HTTP 直连，不主动引入官方 SDK
3. 不写兼容/回退代码，逻辑保持直接、可读、可诊断
4. 修改涉及 provider、参数、配置结构时，必须同步文档

## 代码与架构边界

- 命令层：`src/cli/commands/*`
- 编排层：`src/core/orchestrator.ts`
- Provider 层：`src/providers/*`
- 配置层：`src/config/*`
- 输出层：`src/output/*`

不要把 provider 细节泄漏到命令层，不要在 CLI 命令里直接拼接第三方 API 逻辑。

## 可观测性

- CLI **不提供** `--verbose`；请求/响应与编排失败细节由 **`runtime.logging`（默认开启）** 写入 **`<cwd>/.web/logs/*.log`**（见 `FileLogger`）。
- 终端排障：`web config list` + 日志文件。

## 测试

- **目录**：仅使用 [`tests/`](tests/)（原根目录 `test/` 已并入 [`tests/manual/`](tests/manual/)）。`tests/unit/` 为纯逻辑单测；`tests/integration/` 为对 `dist/index.js` 的子进程 CLI 测试（会读网络或写临时 `WEB_HOME`）；`tests/manual/` 为可逐项执行的 shell 脚本。
- **环境**：Vitest 启动时会加载仓库根目录 [`.env.local`](.env.local)（若存在），便于集成测试继承密钥；**勿将** `.env.local` 提交到 git。
- **隔离**：集成测试通过环境变量 **`WEB_HOME`** 指向临时目录，代替默认的 `~/.web`，避免污染本机配置。产品代码中 [`getConfigPaths()`](src/config/index.ts) 在设置了非空 `WEB_HOME` 时使用其绝对路径作为配置根目录。
- **新功能**：新增或变更命令、CLI 参数、配置结构或 provider 行为时，必须在 `tests/` 下**新增或修改**对应用例，并保持 `npm test` 通过。
- **逐项跑**：可用 `npm run test:one -- tests/integration/cli-root-help.test.ts` 或 `npm run test:unit` / `npm run test:integration` 分批执行。

## 交付前验证

任何实质改动后必须运行并确认通过：

```bash
npm test
```

（`npm test` 已包含 `npm run build`。）并在交付说明中明确给出结果。

## 文档同步清单

当新增或变更 provider/命令参数时，必须同步更新：

- `README.md`
- `docs/provider-curl-mapping.md`
- `docs/onboard.md`
- `docs/plugin-protocol.md`
- `init/skills/web-cli/SKILL.md`
- `init/skills/web-cli/examples.md`
- `init/skills/web-cli/troubleshooting.md`
- `.claude/skills/web-cli/*`（与 `init/skills/web-cli` 保持同一内容，供仓库内 Agent 读取）

