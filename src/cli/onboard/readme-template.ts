export function defaultWebHomeReadme(): string {
  return `# ~/.web 配置目录

更完整的说明（含多账号与 \`--account\` 的进阶用法）见**你安装本 CLI 时的仓库根目录**里的 \`README.md\`。

## 文件

- \`config.toml\` — 各能力的 \`[search|fetch|answer|research]\` 与 \`[*.account.账号id]\`（CLI 默认读 **~/.web**，再在**当前目录 ./.web** 上深度合并）。
- \`.env\` — API 密钥等（勿提交到仓库；仓库内模板名为 \`init/.env.example\`，\`web onboard init\` 会复制为 \`~/.web/.env\`）。
- \`skills/web-cli/\` — 随 onboard 同步的 Agent 技能说明（与仓库 \`init/skills/web-cli\` 同源）。
- \`plugins/\` — 外置插件包目录。

## 环境变量占位

\`config.toml\` 中 \`api_token = "{$TAVILY_API_KEY}"\` 表示从环境变量读取；值写在 \`.env\` 或导出到 shell。

## 多账号与尝试顺序

同一能力段（如 \`[search]\`）下可配置多条 \`[search.account.xxx]\`。**文件中谁先出现，运行时谁先被尝试**；当前这条失败（超时、报错等）会静默换下一个，直到成功或全部失败。

- **同厂商多条**：多条相同 \`provider\`、不同账号 id（例如两个 Tavily key），顺序即 failover 顺序。
- **CLI 收窄范围**：
  - \`web search "q" --provider tavily\`：只在该段里 \`provider = tavily\` 的账号中，**按 config 声明顺序**依次尝试。
  - \`web search "q" --account tavily-backup\`：只用这一条；若同时写 \`--provider tavily\`，会校验该账号是否属于该厂商。
  - \`web fetch …\`、\`web answer "…"\` 同理（\`answer\` 的问题为**位置参数**，不是 \`--query\`）。
- **不要混用**：\`--providers a b\`（多路并发）与 \`--account\` 不能一起用。

## 项目级覆写

在仓库根目录创建 \`./.web/config.toml\`（及可选 \`./.web/.env\`）：与全局 **深度合并**，项目里出现的键覆盖全局，未写的键沿用 \`~/.web\`。

## 常用命令

\`\`\`bash
web config list
web search "关键词"
web fetch https://example.com
web answer "你的问题"
web onboard
\`\`\`
`;
}
