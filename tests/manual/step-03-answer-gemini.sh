#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "skip: GEMINI_API_KEY 未设置"
  exit 0
fi
node "$ROOT/dist/index.js" config set answer gemini_google_default \
  --provider gemini_google_search \
  --token '{$GEMINI_API_KEY}' \
  --enabled true
exec node "$ROOT/dist/index.js" answer --query "What is the capital of France?" --provider gemini_google_search --verbose
