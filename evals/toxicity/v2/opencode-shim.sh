#!/usr/bin/env bash
# Translate eblan's newer OpenCode flags to older installed versions.
# Keeps --pure/--dir in toxbench.py; strips them here and maps --dir to cwd.
# Portable: resolves the real binary via TOXBENCH_OPENCODE_REAL or PATH.
set -euo pipefail
REAL="${TOXBENCH_OPENCODE_REAL:-$(command -v opencode || true)}"
if [ -z "$REAL" ]; then
  echo "opencode-shim: no opencode binary found; set TOXBENCH_OPENCODE_REAL=/path/to/opencode" >&2
  exit 1
fi
args=()
dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pure) shift ;;
    --dir) dir="$2"; shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
if [ -n "$dir" ]; then cd "$dir"; fi
exec "$REAL" "${args[@]}"
