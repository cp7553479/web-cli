[中文文档](README_CN.md)

# Manual / semi-automated scripts

This directory holds one-off shell checks (complementary to Vitest under `npm test`).

**Run one script at a time** when possible so logs under **`<cwd>/.web/logs/`** are easy to correlate.

| Scenario | Tip |
|------|------|
| Project overrides | Use a temp tree with a `.web/config.toml` slice; cross-check merge with logs and `web config list` |
| Jina search smoke | Vitest needs **`WEB_RUN_JINA_SMOKE=1`** and a valid **`JINA_API_KEY`** to hit the network |

Scripts set `ROOT` to the repository root (two levels above `tests/manual/`).
