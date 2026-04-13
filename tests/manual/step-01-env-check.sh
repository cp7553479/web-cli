#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_CMD=(node "$ROOT/dist/index.js")
if [[ ! -f "$ROOT/dist/index.js" ]]; then
  echo "请先: npm run build" >&2
  exit 1
fi
G="$HOME/.web"
echo "检查目录: $G"
if [[ -d "$G" ]]; then
  ls -la "$G" || true
else
  echo "不存在 ~/.web，可运行: node $ROOT/dist/index.js onboard init"
fi
