[中文文档](README_CN.md)

# Agent skills (publish source)

This directory ships with the npm package. `skills/web-cli/` is the
**publish source** of the agent skill (SKILL.md + examples.md +
troubleshooting.md); it is installed to `~/.web/skills/web-cli/`,
`~/.agents/skills/web-cli/`, and every Hermes profile's `skills/` on first
run or `web config init --force`. `.claude/skills/web-cli/` in the repo is a
symlink to it.

Full manual: [README.md](../README.md) / [README_CN.md](../README_CN.md);
authoritative spec: `SPEC.md`.
