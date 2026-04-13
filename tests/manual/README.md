# 手工 / 半自动脚本

本目录用于逐项 shell 验证（与 `npm test` 中的 Vitest 互补）。

**建议每次只跑一个脚本**，便于对照 **`<cwd>/.web/logs/`** 里的请求与响应排障。

| 场景 | 建议 |
|------|------|
| 项目覆写 | 在临时目录建 `.web/config.toml` 片段，结合日志与 `web config list` 核对合并来源 |

脚本内 `ROOT` 指向仓库根目录（`tests/manual/` 的上两级）。
