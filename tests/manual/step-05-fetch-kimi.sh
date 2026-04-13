#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -z "${MOONSHOT_API_KEY:-}" ]]; then
  echo "skip: MOONSHOT_API_KEY 未设置"
  exit 0
fi
node "$ROOT/dist/index.js" config set fetch kimi_fetch_default \
  --provider kimi_fetch \
  --token '{$MOONSHOT_API_KEY}' \
  --enabled true
exec node "$ROOT/dist/index.js" fetch https://example.com --provider kimi_fetch
