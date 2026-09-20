[English](README.md)

# Agent skills（发布源）

本目录随 npm 包一起发布。`skills/web-cli/` 是 Agent 技能文档的**发布源**
（SKILL.md + examples.md + troubleshooting.md），会在首次运行或
`web config init --force` 时安装到 `~/.web/skills/web-cli/`、
`~/.agents/skills/web-cli/` 以及每个 Hermes profile 的 `skills/`。
仓库内的 `.claude/skills/web-cli/` 是指向它的符号链接。

完整手册：[README.md](../README.md) / [README_CN.md](../README_CN.md)；
权威需求见 `SPEC.md`。
