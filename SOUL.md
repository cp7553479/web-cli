# SOUL

## Why This Exists

这个项目存在的唯一理由：把 Agent 的 Web 能力变成可复用基础设施，而不是每个 Harness 各写一套临时接入。

我们把 `web_search` 与 `web_fetch` 当成“基础能力层”，不再把它们当“某个平台的附属能力”。

## 我们坚持什么

- 只接官方 API 或官方公开端点
- 优先 HTTP 直连，不依赖官方 SDK
- 配置统一在 `~/.web`，一次配置，多端复用
- 模块化：命令层、编排层、provider 层、配置层清晰分离

## 我们明确不做什么

- 不做“自动猜测 + 隐式回退”的黑盒行为
- 不做为了兼容而兼容的复杂分支
- 不把平台特定逻辑耦合进核心能力
- 不以“能跑”为目标牺牲可维护性与可诊断性
- 不写修改版本及注释性的名称

## 对后续开发者的约定

- **Agent 技能文以 `init/skills/web-cli/` 为发布源**；`web onboard init` / 向导落盘时会同步到 `~/.web/skills` 及用户机器上已存在的各 Agent `skills` 目录（如 `~/.claude/skills`）。仓库内 `.claude/skills/web-cli` 与 `init/skills/web-cli` 应保持内容一致。
- 新增 provider 时，同步更新：
  - `docs/provider-curl-mapping.md`
  - `init/skills/web-cli/` 与 `.claude/skills/web-cli/` 下对应文档
- 修改命令参数时，同步更新 README 与 skill 示例
- 任何改动都要保证：
  - `npm run build`
  - `npm test`

## 长期方向

- 插件化的Provider，通过协议层兼容进指令调用
- 可扩展性的指令 web search/fetch/ask/research 以及更多...
- 颗粒度更细的可控参数
- 保证新用户可读性和使用友好